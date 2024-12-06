import type { NextApiRequest, NextApiResponse } from "next";
import { createPublicClient, createWalletClient, http } from "viem";
import { mainnet } from "viem/chains";
import { privateKeyToAccount } from 'viem/accounts';
import { createClient } from '@supabase/supabase-js'
import delegateHelperABI from '../../delegateHelperABI.json';
const serviceRoleKey = process.env.SERVICE_ROLE_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;


const delegateHelper = "0x94363B11b37BC3ffe43AB09cff5A010352FE85dC";



const publicClient = createPublicClient({
  chain: mainnet,
  transport: http("https://eth-mainnet.g.alchemy.com/v2/AHvTHUHmlCKWoa5hezH-MTrKWw_MjtUZ")
});

function customParse(obj: any) {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  
  if (obj.type === 'BigInt' && typeof obj.value === 'string') {
    console.log("---- obj.value", obj.value);
    return BigInt(obj.value);
  }
  
  for (let key in obj) {
    obj[key] = customParse(obj[key]);
  }
  
  return obj;
}

const privKey = process.env.PRIVATE_KEY;

if (!privKey) {
  throw new Error("PRIVATE_KEY is not set");
}

const account = privateKeyToAccount(privKey as `0x${string}`);

const walletClient = createWalletClient({
  account: account,
  chain: mainnet,
  transport: http("https://mainnet.infura.io/v3/4d95e2bfc962495dafdb102c23f0ec65")
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    console.log("Request method:", req.method);
    console.log("Request headers:", req.headers);

    if(!supabaseUrl || !serviceRoleKey) {
      return res.status(500).json({ error: "Internal server configuration error" });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const updateGasFreeHistory = async (userAddress: `0x${string}`) => {
      const { data, error } = await supabase.from("gas_free_history").select("*").eq("userAddress", userAddress)
      const userHistory = data?.[0]
      if(userHistory) {
        await supabase.from("gas_free_history").update({ count: userHistory.count + 1 }).eq("userAddress", userAddress)
      } else {
        await supabase.from("gas_free_history").insert({ userAddress, count: 1 });
      }
    }
    
    
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST, OPTIONS, HEAD');
      return res.status(405).json({ error: 'Method Not Allowed' });
    }
  
    const params = customParse(req.body);
    
    try {
  // ガス料金データの取得
    const [maxFeePerGas, maxPriorityFeePerGas] = await Promise.all([
      publicClient.estimateFeesPerGas(),
      publicClient.estimateMaxPriorityFeePerGas(),
    ]);
  
    console.log("maxFeePerGas ", maxFeePerGas.maxFeePerGas)
    console.log("maxFeePerGas * 0.12 * 100 ", (maxFeePerGas.maxFeePerGas * BigInt(120)) / BigInt(100))
    
    // トランザクションの送信
    const hash = await walletClient.writeContract({
      address: delegateHelper,
      abi: delegateHelperABI,
      functionName: 'batchMetaDelegate',
      args: [params],
      maxFeePerGas: (maxFeePerGas.maxFeePerGas * BigInt(120)) / BigInt(100),
      maxPriorityFeePerGas: maxPriorityFeePerGas
    });
  
      updateGasFreeHistory(params[0].delegator)
  
      res.status(200).json({ txHash: hash });
    } catch (error) {
      console.error("Error in executeDelegate:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  } catch(e) {
      updateGasFreeHistory("0xerror:")
  }

}
