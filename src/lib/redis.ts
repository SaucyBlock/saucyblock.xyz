import { Redis } from "@upstash/redis";

if (!process.env.UPSTASH_URL || !process.env.UPSTASH_TOKEN) {
  throw new Error("Missing Upstash Redis credentials");
}

export const redis = new Redis({
  url: process.env.UPSTASH_URL,
  token: process.env.UPSTASH_TOKEN,
});

export const REDIS_KEYS = {
  DELEGATION_STATE: "delegation:state",
  LAST_SYNCED_BLOCK: "delegation:last_synced_block",
  DELEGATOR_INFO: (delegator: string) => `delegator:${delegator}`,
  TOKEN_DELEGATIONS: (token: string) => `delegations:${token}`,
  PROCESSING_LOCK: "delegation:processing_lock",
  DELEGATOR_ARRAY: (token: string) => `delegator_array:${token}`,
  ALL_DELEGATORS: "delegator_array:all",
} as const;

export interface DelegationState {
  delegator: string;
  delegatee: string;
  delegationType: number;
  token: string;
  tokenName: string;
  balance: string;
  blockNumber: number;
  transactionHash: string;
  timestamp: number;
}

export interface DelegatorInfo {
  address: string;
  delegations: {
    token: string;
    tokenName: string;
    delegationType: number;
    balance: string;
    lastUpdatedBlock: number;
  }[];
  totalDelegatedValue?: string;
}