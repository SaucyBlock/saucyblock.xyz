import type { NextApiRequest, NextApiResponse } from "next";
import { createPublicClient, createWalletClient, formatEther, http, PublicClient } from "viem";
import { mainnet } from "viem/chains";
import abis from "../../abi.json"
import { parseAbiItem } from 'viem'
import { DelegateToken } from "@/delegate";
const delegatee = "0x08651EeE3b78254653062BA89035b8F8AdF924CE";
const publicClients = [
  createPublicClient({
    chain: mainnet,
    transport: http("https://eth-mainnet.g.alchemy.com/v2/z0DcWozljD4dS9s_QU1aPLp04-TwKF4L")
  }),
  createPublicClient({
    chain: mainnet,
    transport: http("https://eth-mainnet.g.alchemy.com/v2/AHvTHUHmlCKWoa5hezH-MTrKWw_MjtUZ")
  }),
  createPublicClient({
    chain: mainnet,
    transport: http("https://eth-mainnet.g.alchemy.com/v2/JQQZbWHiH0HV1pFYyFMb1ByJWSh8qfio")
  }),
]

interface LogArgs {
  delegator: string;
  delegatee: string;
  delegationType: number;
  token: DelegateToken;
  balance?: string;
  blockNumber: number;
}

interface DelegateData {
  delegator: string;
  balance: string;
  delegateType: number;
}

type TokenData = {tokenName: string, address: DelegateToken, deployedBlockNumber: number};

const tokenData: TokenData[] = [
    {
      tokenName: "AAVE",
      address: DelegateToken.AAVE,
      deployedBlockNumber: 10926829,
    },
    {
      tokenName: "stkAAVE",
      address: DelegateToken.stkAAVE,
      deployedBlockNumber: 10927018
      
    },
    {
      tokenName: "aAAVE",
      address: DelegateToken.AAAVE,
      deployedBlockNumber: 16496810
    }
];
const getLogs = async(tokenData: TokenData, toBlock: bigint, selectedClient: PublicClient): Promise<LogArgs[]> => {
    const abi = abis[tokenData.address];
    const logs = await selectedClient.getContractEvents({ 
      address: tokenData.address,
      abi: abi,
      eventName: 'DelegateChanged',
      args: {
        delegatee: delegatee
      },
      fromBlock: BigInt(tokenData.deployedBlockNumber),
      toBlock: toBlock
    })
    //@ts-ignore
    const logArgs = logs.map((log) => ({...log.args, token: tokenData.address, blockNumber: Number(log.blockNumber)}))
    return logArgs as LogArgs[];
}

const getLogsForAllTokens = async(tokenData: TokenData[]): Promise<LogArgs[]> => {
  const toBlock = await publicClients[0].getBlockNumber();
  const logs = await Promise.all(tokenData.map((token, index) => getLogs(token, toBlock, publicClients[index % publicClients.length])));
  return logs.flat();
}

const balanceOf = async(token: DelegateToken, publicClient: PublicClient, delegator: string) => {
  const abi = abis[token];
  const balance = await publicClient.readContract({
    address: token,
    abi: abi,
    functionName: 'balanceOf',
    args: [delegator]
  })
  return balance;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const logs = await getLogsForAllTokens(tokenData);
  const used = {} //string(tokenAddress + delegateType + delegator)
  const sortedLogs = logs.sort((a, b) => b.blockNumber - a.blockNumber);
  const results = await Promise.all(sortedLogs.map(async (log, i) => {
    //@ts-ignore
    const key = `${log.token}-${log.delegationType}-${log.delegator}`;
    //@ts-ignore
    if(used[key]) {
      return;
    }
    //@ts-ignore
    used[key] = true;
    const balanceInWei = await balanceOf(log.token, publicClients[i % publicClients.length], log.delegator);
    log.balance = formatEther(BigInt(balanceInWei?.toString() as string));
    return log;
  }));

  const moreThan0 = results.filter(log => log && log?.balance !== "0");
  console.log("--------------------------------");
  res.status(200).json(moreThan0);
}


