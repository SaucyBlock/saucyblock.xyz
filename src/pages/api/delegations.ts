import { NextApiRequest, NextApiResponse } from 'next';
import { OptimizedDelegationSyncService, publicClients } from '@/services/delegationSync';
import { redis, REDIS_KEYS } from '@/lib/redis';
import { formatEther } from 'viem';
import abis from '@/abi.json';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Use cached data from Redis for performance - temporarily disabled for debugging
    // const cacheKey = 'dashboard_data_cache';
    // const cached = await redis.get(cacheKey);
    
    // if (cached && typeof cached === 'string') {
    //   try {
    //     const cachedData = JSON.parse(cached);
    //     if (Date.now() - cachedData.timestamp < 30000) {
    //       return res.status(200).json(cachedData.data);
    //     }
    //   } catch (error) {
    //     console.error('Error parsing cached data:', error);
    //     // Continue with fresh data if cache is corrupted
    //   }
    // }
    
    const syncService = new OptimizedDelegationSyncService();
    
    // Get delegation stats (includes delegatee powers)
    const stats = await syncService.getDelegationStats();
    
    // Get active delegators list
    const activeDelegators = await syncService.getActiveDelegators();
    
    // Get last sync time
    const lastSyncBlock = await redis.get(REDIS_KEYS.LAST_SYNCED_BLOCK);
    
    // Get all delegation states in one Redis call
    const allDelegationStates = await redis.hgetall(REDIS_KEYS.DELEGATION_STATE);
    
    // Process delegators efficiently using cached data
    const delegatorDetailsWithTotal: any[] = [];
    const delegatorDataMap = new Map<string, any>();
    
    // Group delegation data by delegator
    if (allDelegationStates) {
      for (const [key, value] of Object.entries(allDelegationStates)) {
        try {
          const state = typeof value === 'string' ? JSON.parse(value) : value;
          if (state.delegatee === stats.delegatee && parseFloat(state.balance) > 0) {
            const delegator = state.delegator;
            
            if (!delegatorDataMap.has(delegator)) {
              delegatorDataMap.set(delegator, {
                address: delegator,
                totalVotes: 0,
                delegationsByToken: {},
                tokenBalances: {},
                delegations: []
              });
            }
            
            const delegatorData = delegatorDataMap.get(delegator);
            const tokenName = state.tokenName;
            
            // Initialize token data if not exists
            if (!delegatorData.delegationsByToken[tokenName]) {
              delegatorData.delegationsByToken[tokenName] = { voting: false, proposition: false, balance: state.balance };
              delegatorData.tokenBalances[tokenName] = state.balance;
            }
            
            // Set delegation type
            if (state.delegationType === 0) {
              delegatorData.delegationsByToken[tokenName].voting = true;
            } else {
              delegatorData.delegationsByToken[tokenName].proposition = true;
            }
            
            delegatorData.totalVotes += parseFloat(state.balance);
            delegatorData.delegations.push({
              tokenName: state.tokenName,
              delegationType: state.delegationType === 0 ? 'VOTING' : 'PROPOSITION',
              balance: state.balance
            });
          }
        } catch (error) {
          console.error(`Error parsing delegation state for key ${key}:`, error);
          continue;
        }
      }
    }
    
    // Convert map to array and sort
    const delegatorDetailsArray = Array.from(delegatorDataMap.values());
    delegatorDetailsArray.sort((a, b) => b.totalVotes - a.totalVotes);
    
    // Take top 100 for display
    const delegatorDetails = delegatorDetailsArray.slice(0, 100);
    
    const responseData = {
      stats,
      lastSyncBlock,
      totalDelegators: activeDelegators.length,
      delegatorDetails,
      delegateeHoldings: {}, // Remove delegatee holdings to reduce API calls
      hasMore: activeDelegators.length > 100
    };
    
    // Cache the response for 30 seconds - temporarily disabled for debugging
    // await redis.set(cacheKey, JSON.stringify({
    //   data: responseData,
    //   timestamp: Date.now()
    // }), { ex: 60 }); // Cache for 1 minute with 30s check
    
    res.status(200).json(responseData);
  } catch (error) {
    console.error('Error fetching delegation data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}