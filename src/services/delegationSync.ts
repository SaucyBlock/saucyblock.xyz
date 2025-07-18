import { createPublicClient, http, formatEther } from "viem";
import { mainnet } from "viem/chains";
import { redis, REDIS_KEYS, DelegationState, DelegatorInfo } from "@/lib/redis";
import abis from "@/abi.json";
import { DelegateToken } from "@/delegate";

const DELEGATEE = "0x08651EeE3b78254653062BA89035b8F8AdF924CE";
const BLOCK_RANGE = 400; // Query blocks in chunks (Alchemy limit)
const GENESIS_BLOCK = 18911987;

export const publicClients = [
  createPublicClient({
    chain: mainnet,
    transport: http(process.env.ALCHEMY_RPC_URL_1 || "https://eth-mainnet.g.alchemy.com/v2/z0DcWozljD4dS9s_QU1aPLp04-TwKF4L")
  }),
  createPublicClient({
    chain: mainnet,
    transport: http(process.env.ALCHEMY_RPC_URL_2 || "https://eth-mainnet.g.alchemy.com/v2/AHvTHUHmlCKWoa5hezH-MTrKWw_MjtUZ")
  }),
  createPublicClient({
    chain: mainnet,
    transport: http(process.env.ALCHEMY_RPC_URL_3 || "https://eth-mainnet.g.alchemy.com/v2/JQQZbWHiH0HV1pFYyFMb1ByJWSh8qfio")
  }),
];

export const TOKEN_DATA = [
  {
    tokenName: "AAVE",
    address: DelegateToken.AAVE,
    deployedBlockNumber: 10926829,
  },
  {
    tokenName: "stkAAVE",
    address: DelegateToken.stkAAVE,
    deployedBlockNumber: 10927018,
  },
  {
    tokenName: "aAAVE",
    address: DelegateToken.AAAVE,
    deployedBlockNumber: 16496810,
  },
];

// Updated Redis keys to include active delegators list
export const EXTENDED_REDIS_KEYS = {
  ...REDIS_KEYS,
  ACTIVE_DELEGATORS: (delegatee: string) => `active_delegators:${delegatee}`,
  LAST_ANALYZED_BLOCK: (tokenAddress: string) => `last_analyzed_block:${tokenAddress}`,
};

export class OptimizedDelegationSyncService {
  private processingLock = false;

  async syncDelegations(fromBlock?: number) {
    if (this.processingLock) {
      console.log("Sync already in progress, skipping...");
      return;
    }

    try {
      this.processingLock = true;
      await redis.set(REDIS_KEYS.PROCESSING_LOCK, "true", { ex: 300 }); // 5 min TTL

      const currentBlock = await publicClients[0].getBlockNumber();
      console.log(`Current block: ${currentBlock}`);

      // Track all active delegators across all tokens
      const activeDelegators = new Set<string>();

      // Process each token independently
      for (const token of TOKEN_DATA) {
        const lastAnalyzedBlock = fromBlock || await this.getLastAnalyzedBlock(token.address);
        const startBlock = BigInt(Math.max(lastAnalyzedBlock, token.deployedBlockNumber));

        console.log(`Processing ${token.tokenName} from block ${startBlock} to ${currentBlock}`);

        // Process events and update delegation status immediately
        const tokenActiveDelegators = await this.processTokenDelegations(
          token,
          startBlock,
          currentBlock
        );

        // Add to overall active delegators set
        tokenActiveDelegators.forEach(d => activeDelegators.add(d));

        // Update last analyzed block for this token
        await redis.set(
          EXTENDED_REDIS_KEYS.LAST_ANALYZED_BLOCK(token.address),
          currentBlock.toString(),
          { ex: 86400 * 7 } // 7 days TTL
        );
      }

      // Update the active delegators list for the DELEGATEE
      await this.updateActiveDelegatorsList(Array.from(activeDelegators));

      // Update global last synced block
      await redis.set(REDIS_KEYS.LAST_SYNCED_BLOCK, currentBlock.toString());
      console.log(`Sync completed. Active delegators: ${activeDelegators.size}`);

    } catch (error) {
      console.error("Error during delegation sync:", error);
      throw error;
    } finally {
      this.processingLock = false;
      await redis.del(REDIS_KEYS.PROCESSING_LOCK);
    }
  }

  private async processTokenDelegations(
    tokenData: typeof TOKEN_DATA[0],
    fromBlock: bigint,
    toBlock: bigint
  ): Promise<Set<string>> {
    const clientIndex = TOKEN_DATA.indexOf(tokenData) % publicClients.length;
    const client = publicClients[clientIndex];
    const activeDelegators = new Set<string>();
    
    let currentFromBlock = fromBlock;

    while (currentFromBlock < toBlock) {
      const currentToBlock = currentFromBlock + BigInt(BLOCK_RANGE) > toBlock
        ? toBlock
        : currentFromBlock + BigInt(BLOCK_RANGE);

      try {
        // Get DelegateChanged events where someone delegates TO our DELEGATEE
        const delegateToEvents = await client.getContractEvents({
          address: tokenData.address as `0x${string}`,
          abi: abis[tokenData.address],
          eventName: "DelegateChanged",
          args: {
            delegatee: DELEGATEE,
          },
          fromBlock: currentFromBlock,
          toBlock: currentToBlock,
        });

        console.log(
          `Block ${currentFromBlock}-${currentToBlock}: ${delegateToEvents.length} delegate`
        );

        // Process delegators who delegated TO our address
        for (const log of delegateToEvents) {
          const args = (log as any).args;
          if (args && args.delegator) {
            console.log("✅", args.delegator);
            const delegator = args.delegator;
            const isActive = await this.updateDelegatorStatus(delegator, tokenData, client);
            if (isActive) {
              activeDelegators.add(delegator);
            }
          }
        }


      } catch (error) {
        console.error(
          `Error processing blocks ${currentFromBlock}-${currentToBlock} for ${tokenData.tokenName}:`,
          error
        );
      }

      currentFromBlock = currentToBlock + BigInt(1);
    }

    return activeDelegators;
  }

  async updateDelegatorStatus(
    delegator: string,
    tokenData: typeof TOKEN_DATA[0],
    client: any
  ): Promise<boolean> {
    try {
      console.log("🔍", delegator);
      // Get current delegation status
      const [votingDelegatee, propositionDelegatee] = await client.readContract({
        address: tokenData.address as `0x${string}`,
        abi: abis[tokenData.address],
        functionName: "getDelegates",
        args: [delegator],
      }) as [string, string];
      console.log("🔍2", votingDelegatee, propositionDelegatee);

      // Get balance (still needed to check if > 0)
      const balance = await client.readContract({
        address: tokenData.address as `0x${string}`,
        abi: abis[tokenData.address],
        functionName: "balanceOf",
        args: [delegator],
      }) as bigint;
      console.log("🔍3", balance);

      const currentBlock = Number(await client.getBlockNumber());
      let hasActiveDelegation = false;

      // Get the actual delegated power for the DELEGATEE
      let votingPower = BigInt(0);
      let propositionPower = BigInt(0);
      
      if (balance > BigInt(0)) {
        try {
          const [votingPowerResult, propositionPowerResult] = await client.readContract({
            address: tokenData.address as `0x${string}`,
            abi: abis[tokenData.address],
            functionName: "getPowersCurrent",
            args: [DELEGATEE],
          }) as [bigint, bigint];
          
          votingPower = votingPowerResult;
          propositionPower = propositionPowerResult;
          console.log("🔍4 Powers for DELEGATEE:", votingPower.toString(), propositionPower.toString());
        } catch (error) {
          console.error("Error getting powers for DELEGATEE:", error);
        }
      }

      console.log("🔍5", votingDelegatee.toLowerCase() === DELEGATEE.toLowerCase(), balance > BigInt(0));

      // Check voting power delegation
      if (votingDelegatee.toLowerCase() === DELEGATEE.toLowerCase() && balance >= BigInt(0)) {
        const state: DelegationState = {
          delegator,
          delegatee: DELEGATEE,
          delegationType: 0, // VOTING
          token: tokenData.address,
          tokenName: tokenData.tokenName,
          balance: formatEther(balance),
          blockNumber: currentBlock,
          transactionHash: "",
          timestamp: Date.now(),
        };
        console.log("🔍6", state);

        const key = `${tokenData.address}:0:${delegator}`;
        await redis.hset(REDIS_KEYS.DELEGATION_STATE, {
          [key]: JSON.stringify(state),
        });
        console.log("🔍7", key);

        hasActiveDelegation = true;
      } else {
        // Remove voting delegation if exists
        const key = `${tokenData.address}:0:${delegator}`;
        await redis.hdel(REDIS_KEYS.DELEGATION_STATE, key);
      }

      // Check proposition power delegation
      if (propositionDelegatee.toLowerCase() === DELEGATEE.toLowerCase() && balance >= BigInt(0)) {
        const state: DelegationState = {
          delegator,
          delegatee: DELEGATEE,
          delegationType: 1, // PROPOSITION
          token: tokenData.address,
          tokenName: tokenData.tokenName,
          balance: formatEther(balance),
          blockNumber: currentBlock,
          transactionHash: "",
          timestamp: Date.now(),
        };

        console.log("🔍8", state);

        const key = `${tokenData.address}:1:${delegator}`;
        await redis.hset(REDIS_KEYS.DELEGATION_STATE, {
          [key]: JSON.stringify(state),
        });
        console.log("🔍9", key);

        hasActiveDelegation = true;
      } else {
        // Remove proposition delegation if exists
        const key = `${tokenData.address}:1:${delegator}`;
        await redis.hdel(REDIS_KEYS.DELEGATION_STATE, key);
      }

      // Update delegator info
      if (hasActiveDelegation) {
        console.log("🔍9", delegator);
        await this.updateDelegatorInfo(delegator);
        console.log("🔍10", delegator);
      } else {
        // Remove delegator info if no active delegations
        await redis.del(REDIS_KEYS.DELEGATOR_INFO(delegator));
      }

      return hasActiveDelegation;

    } catch (error) {
      console.error(`Error updating delegation status for ${delegator} on ${tokenData.tokenName}:`, error);
      return false;
    }
  }

  private async removeDelegation(delegator: string, tokenData: typeof TOKEN_DATA[0]) {
    // Remove both voting and proposition delegations
    const votingKey = `${tokenData.address}:0:${delegator}`;
    const propositionKey = `${tokenData.address}:1:${delegator}`;
    
    await redis.hdel(REDIS_KEYS.DELEGATION_STATE, votingKey, propositionKey);
    
    // Check if delegator has any remaining delegations
    const remainingDelegations = await this.getDelegatorActiveDelegations(delegator);
    if (remainingDelegations.length === 0) {
      await redis.del(REDIS_KEYS.DELEGATOR_INFO(delegator));
    } else {
      await this.updateDelegatorInfo(delegator);
    }
  }

  private async updateDelegatorInfo(delegator: string) {
    const delegations = await this.getDelegatorActiveDelegations(delegator);
    
    if (delegations.length > 0) {
      const delegatorInfo: DelegatorInfo = {
        address: delegator,
        delegations: delegations.map(d => ({
          token: d.token,
          tokenName: d.tokenName,
          delegationType: d.delegationType,
          balance: d.balance,
          lastUpdatedBlock: d.blockNumber,
        })),
      };

      await redis.set(
        REDIS_KEYS.DELEGATOR_INFO(delegator),
        JSON.stringify(delegatorInfo),
        { ex: 86400 * 7 } // 7 days TTL
      );
    }
  }

  async getDelegatorActiveDelegations(delegator: string): Promise<DelegationState[]> {
    const delegations: DelegationState[] = [];
    
    for (const token of TOKEN_DATA) {
      for (const delegationType of [0, 1]) {
        const key = `${token.address}:${delegationType}:${delegator}`;
        const state = await redis.hget(REDIS_KEYS.DELEGATION_STATE, key);
        console.log("🔍?", key, state, typeof state);
        if (state) {
          delegations.push(typeof state == 'string' ? JSON.parse(state) as DelegationState : state as DelegationState);
        }
      }
    }
    
    return delegations;
  }

  private async updateActiveDelegatorsList(delegators: string[]) {
    // Store the list of addresses currently delegating to the DELEGATEE
    if (delegators.length > 0) {
      await redis.set(
        EXTENDED_REDIS_KEYS.ACTIVE_DELEGATORS(DELEGATEE),
        JSON.stringify(delegators),
        { ex: 86400 * 7 } // 7 days TTL
      );
    }
  }

  private async getLastAnalyzedBlock(tokenAddress: string): Promise<number> {
    const lastBlock = await redis.get(EXTENDED_REDIS_KEYS.LAST_ANALYZED_BLOCK(tokenAddress));
    if (lastBlock) {
      return parseInt(lastBlock as string);
    }
    
    // Fallback to global last synced block
    const globalLastBlock = await redis.get(REDIS_KEYS.LAST_SYNCED_BLOCK);
    return globalLastBlock ? parseInt(globalLastBlock as string) : GENESIS_BLOCK;
  }

  async getActiveDelegators(): Promise<string[]> {
    const cached = await redis.get(EXTENDED_REDIS_KEYS.ACTIVE_DELEGATORS(DELEGATEE));
    if (cached && typeof cached === 'string') {
      try {
        return JSON.parse(cached) as string[];
      } catch (error) {
        console.error('Error parsing active delegators cache:', error);
        // Fall through to rebuild
      }
    }
    
    // Fallback: rebuild from delegation states
    const delegationStates = await redis.hgetall(REDIS_KEYS.DELEGATION_STATE);
    const delegatorSet = new Set<string>();
    
    if (delegationStates) {
      for (const [key, value] of Object.entries(delegationStates)) {
        try {
          const state = typeof value === 'string' ? JSON.parse(value) as DelegationState : value as DelegationState;
          if (state.delegatee === DELEGATEE && parseFloat(state.balance) > 0) {
            delegatorSet.add(state.delegator);
          }
        } catch (error) {
          console.error(`Error parsing delegation state for key ${key}:`, error);
          continue;
        }
      }
    }
    
    return Array.from(delegatorSet);
  }

  async refreshSingleDelegator(delegatorAddress: string) {
    console.log(`Refreshing delegation status for ${delegatorAddress}`);
    
    for (const token of TOKEN_DATA) {
      const clientIndex = TOKEN_DATA.indexOf(token) % publicClients.length;
      const client = publicClients[clientIndex];
      
      await this.updateDelegatorStatus(delegatorAddress, token, client);
    }
  }

  async getDelegationStats() {
    // Check cache first - temporarily disabled for debugging
    // const cacheKey = 'delegation_stats_cache';
    // const cached = await redis.get(cacheKey);
    // if (cached && typeof cached === 'string') {
    //   try {
    //     const cachedData = JSON.parse(cached);
    //     if (Date.now() - cachedData.timestamp < 60000) { // 1 minute cache
    //       return cachedData.data;
    //     }
    //   } catch (error) {
    //     console.error('Error parsing cached stats:', error);
    //     // Continue with fresh data if cache is corrupted
    //   }
    // }

    const activeDelegators = await this.getActiveDelegators();
    const delegationStates = await redis.hgetall(REDIS_KEYS.DELEGATION_STATE);
    
    const stats = {
      totalActiveDelegators: activeDelegators.length,
      delegatee: DELEGATEE,
      lastAnalyzedBlocks: {} as Record<string, number>,
      tokenStats: {} as Record<string, {
        delegators: number;
        totalBalance: string;
        votingPowerDelegators: number;
        propositionPowerDelegators: number;
        delegateeVotingPower: string;
        delegateePropositionPower: string;
      }>,
    };

    // Batch RPC calls for better performance
    const powerPromises = TOKEN_DATA.map(async (tokenData) => {
      const client = publicClients[TOKEN_DATA.indexOf(tokenData) % publicClients.length];
      try {
        console.log(`Getting powers for ${tokenData.tokenName} (${tokenData.address}) for delegatee ${DELEGATEE}`);
        const [votingPower, propositionPower] = await client.readContract({
          address: tokenData.address as `0x${string}`,
          abi: abis[tokenData.address],
          functionName: "getPowersCurrent",
          args: [DELEGATEE],
        }) as [bigint, bigint];
        
        const result = {
          tokenName: tokenData.tokenName,
          votingPower: formatEther(votingPower),
          propositionPower: formatEther(propositionPower)
        };
        console.log(`Powers for ${tokenData.tokenName}:`, result);
        return result;
      } catch (error) {
        console.error(`Error getting powers for ${tokenData.tokenName}:`, error);
        return {
          tokenName: tokenData.tokenName,
          votingPower: "0",
          propositionPower: "0"
        };
      }
    });

    // Initialize token stats and get last analyzed blocks
    for (const tokenData of TOKEN_DATA) {
      stats.tokenStats[tokenData.tokenName] = {
        delegators: 0,
        totalBalance: "0",
        votingPowerDelegators: 0,
        propositionPowerDelegators: 0,
        delegateeVotingPower: "0",
        delegateePropositionPower: "0",
      };
      
      // Get last analyzed block for each token
      const lastBlock = await redis.get(EXTENDED_REDIS_KEYS.LAST_ANALYZED_BLOCK(tokenData.address));
      stats.lastAnalyzedBlocks[tokenData.tokenName] = lastBlock ? parseInt(lastBlock as string) : 0;
    }
    
    // Wait for all power calls to complete
    const powerResults = await Promise.all(powerPromises);
    
    // Apply power results
    for (const result of powerResults) {
      console.log(`Applying power results for ${result.tokenName}:`, result);
      stats.tokenStats[result.tokenName].delegateeVotingPower = result.votingPower;
      stats.tokenStats[result.tokenName].delegateePropositionPower = result.propositionPower;
    }
    
    console.log('Final stats with powers:', JSON.stringify(stats.tokenStats, null, 2));

    // Process delegation states
    if (delegationStates) {
      for (const [key, value] of Object.entries(delegationStates)) {
        try {
          const state = typeof value === 'string' ? JSON.parse(value) as DelegationState : value as DelegationState;
          
          if (state.delegatee === DELEGATEE && parseFloat(state.balance) > 0) {
            const tokenStat = stats.tokenStats[state.tokenName];
            if (tokenStat) {
              tokenStat.totalBalance = (
                parseFloat(tokenStat.totalBalance) + parseFloat(state.balance)
              ).toString();

              if (state.delegationType === 0) {
                tokenStat.votingPowerDelegators++;
              } else {
                tokenStat.propositionPowerDelegators++;
              }
            }
          }
        } catch (error) {
          console.error(`Error parsing delegation state for key ${key}:`, error);
          continue;
        }
      }
    }

    // Count unique delegators per token
    for (const tokenName of Object.keys(stats.tokenStats)) {
      const tokenData = TOKEN_DATA.find(t => t.tokenName === tokenName);
      if (tokenData) {
        const uniqueDelegators = new Set<string>();
        
        for (const delegator of activeDelegators) {
          const votingKey = `${tokenData.address}:0:${delegator}`;
          const propositionKey = `${tokenData.address}:1:${delegator}`;
          
          const hasVoting = await redis.hexists(REDIS_KEYS.DELEGATION_STATE, votingKey);
          const hasProposition = await redis.hexists(REDIS_KEYS.DELEGATION_STATE, propositionKey);
          
          if (hasVoting || hasProposition) {
            uniqueDelegators.add(delegator);
          }
        }
        
        stats.tokenStats[tokenName].delegators = uniqueDelegators.size;
      }
    }

    // Cache the result - temporarily disabled for debugging
    // await redis.set(cacheKey, JSON.stringify({
    //   data: stats,
    //   timestamp: Date.now()
    // }), { ex: 120 }); // Cache for 2 minutes
    
    return stats;
  }
}




