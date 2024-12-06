import React, { useEffect, useState } from 'react'
import { IBM_Plex_Sans } from 'next/font/google'
import Image from 'next/image'
import { createPublicClient, createWalletClient, http, custom, PublicClient, WalletClient, Address, Hash, Hex, parseAbi, parseUnits, parseEther, zeroAddress } from 'viem'
import { mainnet } from 'viem/chains'
import { switchChain } from 'viem/actions'
import { metaDelegate, DelegateToken, getBalance, getDelegatee, metaDelegateALL, getTotalDelegated } from "../delegate"
import { formatEther } from 'viem'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CheckCircle, Loader2, LogOut, X, XCircle } from 'lucide-react'
import { motion, AnimatePresence } from "framer-motion";
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
// import { Checkbox } from "@/components/ui/checkbox"
import { createClient } from '@supabase/supabase-js'

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['200', '300', '400', '500', '600', '700'],
})

async function isGasLessLimitReached(userAddress: `0x${string}`) {
  console.log("isGasLessLimitReached --------------- ", userAddress)
  if(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_ANON_SUPABASE && process.env.NEXT_PUBLIC_GAS_LESS_LIMIT) {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_ANON_SUPABASE)
    const { data, error } = await supabase.from("gas_free_history").select("*").eq("userAddress", userAddress)
    console.log("data ", data)
    const userHistoryCount = data?.[0]?.count ? data[0].count : 0
    console.log("userHistoryCount ", userHistoryCount, process.env.NEXT_PUBLIC_GAS_LESS_LIMIT)
    return userHistoryCount > Number(process.env.NEXT_PUBLIC_GAS_LESS_LIMIT)
  }
  return false
}

async function isSufficientBalance(userAddress: `0x${string}`, tokenAddress: DelegateToken) {
  const tokens = tokenAddress ? [tokenAddress] : [DelegateToken.AAVE, DelegateToken.stkAAVE, DelegateToken.AAAVE]
  const tasks: Promise<any>[] = []
  for(const token of tokens) {
    const task = getBalance(token, userAddress)
    tasks.push(task)
  }
  const balances = await Promise.all(tasks)
  const goodBalances = balances.filter((balance) => Number(formatEther(balance)) >= Number(process.env.NEXT_PUBLIC_GAS_LESS_BALANCE_IN_ETHER))
  console.log("goodBalances ", goodBalances)
  return goodBalances.length > 0
}

const bgImageLink = "https://firebasestorage.googleapis.com/v0/b/ucai-d6677.appspot.com/o/aavebg.png?alt=media&token=66c91456-3914-4f91-95ab-5aa727448ec7"

const tokenData: any[] = [
  {
    iconUrl: "/cute_aave2.png",
    tokenName: "All Token",
    buttonText: "delegate all",
    delegateToken: "",
    address: ""
  },
  {
    iconUrl: "/aave.png",
    tokenName: "AAVE",
    buttonText: "delegate AAVE",
    delegateToken: "AAVE",
    address: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9"
  },
  {
    iconUrl: "/aAAVE.png",
    tokenName: "stkAAVE",
    buttonText: "delegate stkAAVE",
    delegateToken: "stkAAVE",
    address: "0x4da27a545c0c5B758a6BA100e3a049001de870f5"
  },
  {
    iconUrl: "/aave.png",
    tokenName: "aAAVE",
    buttonText: "delegate aAAVE",
    delegateToken: "aAAVE",
    address: "0xA700b4eB416Be35b2911fd5Dee80678ff64fF6C9"
  }
]

type TabButtonProps = {
  label: string
  isActive: boolean
  onClick: () => void
}

const TabButton = ({ label, isActive, onClick }: TabButtonProps) => (
  <button
    className={`px-2 py-1 text-[15px] ${ibmPlexSans.className} ${
      isActive
        ? 'text-white font-light'
        : 'text-white/70 hover:text-white font-extralight'
    }`}
    onClick={onClick}
  >
    {label}
  </button>
)

type TitleProps = {
  activeTab: string;
}


const Title = ({ activeTab }: TitleProps) => {
  const [content, setContent] = useState("Saucy Block");

  useEffect(() => {
    let currentContent;
    if(activeTab === "about") currentContent = "Saucy Block";
    if(activeTab === "AAVE") currentContent = "10000";
    if(activeTab === "aAAVE") currentContent = "1000";
    if(activeTab === "stkAAVE") currentContent = "100000";
    setContent(currentContent as string);
  }, [activeTab]);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={content}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className={`w-full md:w-[525px] text-white ${ibmPlexSans.className} text-[60px] md:text-[110px] font-extralight leading-none mb-4 tracking-[-3px] md:tracking-[-6.6px]`}
        style={{fontWeight: 100, textShadow: "0px 4px 55px #FFF"}}
      >
        {content}
      </motion.div>
    </AnimatePresence>
  );
}

const DetailTexts = () => {
  return (
    <div className={`w-full md:w-[474px] text-white opacity-70 ${ibmPlexSans.className} font-extralight text-[11px] leading-[16px] mb-6`}>
      We are the Aave Delegate Platform, founded in January 2024. Our team contributes to the long-term prosperity of the Aave DAO and its ecosystem through making proposls and reviewing proposals, voting, and developing products that integrate Aave. Here, you can delegate your tokens to saucyblock.eth free-gas.
    </div>
  )
}

const DelegateModal = ({ isOpen, onClose, onConfirm, isProcessing,}: { isOpen: boolean, onClose: () => void, onConfirm: (isGasLess: boolean) => Promise<string>, isProcessing: boolean, }) => {
  const [showSuccess, setShowSuccess] = useState(false)
  const [isUseGasless, setUseGasless] = useState(true);

  const handleConfirm = async () => {
    const hash = await onConfirm(isUseGasless)
    setShowSuccess(hash ? true : false)
    setTimeout(() => {
      setShowSuccess(false)
      onClose()
    }, 2000)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] rounded-2xl h-[500px] overflow-y-auto fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col justify-between">
        <div>
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
            tabIndex={-1}
            aria-hidden="true"
          >
            <X className="h-4 w-4 text-black outline-none" />
            <span className="sr-only">Close</span>
          </button>
          <DialogHeader>
            <DialogTitle>Confirm Delegation</DialogTitle>
            <DialogDescription>
              Are you sure you want to proceed with the delegation?
            </DialogDescription>
          </DialogHeader>
        </div>
        
        <div className="flex justify-center items-center flex-grow">
          <Image src="/cute_aave.png" alt="Cute AAVE" width={300} height={300} />
        </div>
        
        <div className="flex items-end space-y-2 w-full mb-1">
          <Switch
            id="use-gasless"
            checked={isUseGasless}
            onCheckedChange={() => setUseGasless(!isUseGasless)}
          />
          <Label htmlFor="use-gasless" className="text-sm text-gray-400 text-[12px] ml-2">useGasless</Label>
        </div>
        <DialogFooter className="flex flex-col w-full">
          {isProcessing ? (
            <Button 
              className="w-full h-[40px] bg-[#2B2D3C] text-white flex items-center justify-center"
              disabled
            >
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              Processing delegation...
            </Button>
          ) : showSuccess ? (
            <div className="flex items-center justify-center w-full h-[40px] bg-green-500 text-white rounded">
              <CheckCircle className="mr-2" />
              <p>Delegation successful!</p>
            </div>
          ) : (
            <Button 
              className="border-black-300 border bg-[#2B2D3C] text-white w-full h-[40px] hover:bg-black hover:text-white" 
              onClick={handleConfirm}
            >
              delegate to saucyblock!!!
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Token({ info, handleDelegate, sumDelegated }: { info: TokenInfo, handleDelegate: any, sumDelegated: number }) {
  const { iconUrl, tokenName, buttonText, balance, vote, proposal, address, totalDelegated } = info;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const onConfirmDelegate = async (isGasLess: boolean) => {
    setIsProcessing(true);
    let hash;
    try {
      hash = await handleDelegate(address, isGasLess);
    } finally {
      setIsProcessing(false);
    }
    return hash;
  }

  const showDetails = tokenName !== "All Token";
  
  const imageAnimation = {
    animate: {
      x: [0, 3, -5, 3, 2], // Reduced movement range for subtler animation
      transition: {
        duration: 4, // Increased duration for slower animation
        repeat: Infinity,
        repeatType: "reverse" as const,
        ease: "easeInOut",
      },
    },
  };
  return (
    <div
      className={`text-white p-4 md:p-6 pb-1 rounded-2xl w-full md:w-[560px] flex flex-col justify-between ${ibmPlexSans.className}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <AnimatePresence>
            {tokenName === "All Token" ? (
              <motion.div
                variants={imageAnimation}
                animate="animate"
              >
                <Image
                  src={iconUrl}
                  alt={`${tokenName} Logo`}
                  width={tokenName === "All Token" ? 90 : 60}
                  height={tokenName === "All Token" ? 90 : 60}
                  className="rounded-full mr-0 md:mr-6"
                />
              </motion.div>
            ) : (
              <Image
                src={iconUrl}
                alt={`${tokenName} Logo`}
                width={60}
                height={60}
                className="rounded-full mr-0 md:mr-6"
              />
            )}
          </AnimatePresence>
          <h1 className="text-[30px] md:text-[50px] font-extralight tracking-[-2px] md:tracking-[-3.6px]">
            {tokenName}
          </h1>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="w-[100px] md:w-[127px] h-[35px] md:h-[45px] rounded-[15px] bg-[rgba(22,22,22,0.20)] flex items-center justify-center"
        >
          <span className="h-[33px] flex items-center opacity-[70%] text-white text-[10px] md:text-[12px] font-light">
            {buttonText}
          </span>
        </button>
      </div>
      {!showDetails ? ( 
        <div className={`${ibmPlexSans.className} font-white-20 text-[10px] mt-0.5 md:mt-0`}>
          <span className={`${ibmPlexSans.className} font-white opacity-[50%] text-[10px]`}>
            total delegated:
          </span>
          <span className={`${ibmPlexSans.className} mt-[-2px] text-white font-extralight text-[25px] ${proposal ? '' : 'opacity-[80%]'}`}>{sumDelegated}</span>
        </div>
      ) : (
        <div className="flex flex-row text-left mt-2 md:mt-0 space-x-8">
          <div className={`${ibmPlexSans.className} font-white-20 text-[10px]`}>
            <span className={`${ibmPlexSans.className} font-white-20 opacity-[50%] text-[10px]`}>
              your balance:
            </span>
            <span className="mt-[-2px] text-[8px]">
              {balance ? (balance.slice(0,8)) : '-'}
            </span>
          </div>
          <div className={`${ibmPlexSans.className} font-white-20 text-[10px] mt-0.5 md:mt-0`}>
            <span className={`${ibmPlexSans.className} font-white opacity-[50%] text-[10px]`}>
              vote: 
            </span>
            <span className={`${ibmPlexSans.className} mt-[-2px] text-[8px] ${vote ? '' : 'opacity-[80%]'}`}>{vote || "Not delegated"}</span>
          </div>
          <div className={`${ibmPlexSans.className} font-white-20 text-[10px] mt-0.5 md:mt-0`}>
            <span className={`${ibmPlexSans.className} font-white opacity-[50%] text-[10px]`}>
              proposal: 
            </span>
            <span className={`${ibmPlexSans.className} mt-[-2px] text-[8px] ${proposal ? '' : 'opacity-[80%]'}`}>{proposal || "Not delegated"}</span>
          </div>
          <div className={`${ibmPlexSans.className} font-white-20 text-[10px] mt-0.5 md:mt-0`}>
            <span className={`${ibmPlexSans.className} font-white opacity-[50%] text-[10px]`}>
              total delegated: 
            </span>
            <span className={`${ibmPlexSans.className} mt-[-2px] text-[8px]`}>
              {totalDelegated ? totalDelegated.slice(0, 8) : '-'}
            </span>
          </div>
        </div>
      )}
      <DelegateModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={(isGasLess: boolean) => onConfirmDelegate(isGasLess)}
        isProcessing={isProcessing}
      />
    </div>
  );
}

interface Tab {
  name: string,
  link: string
}

function AboutUs() {
  const tabs: Tab[] = [
    {name: "about", link: "hhttps://governance.aave.com/t/saucy-block-delegate-platform/16115"}, 
    {name: "forum", link: " https://governance.aave.com/u/saucyblock/summary"}, 
    {name: "twitter", link: "https://x.com/saucy_block"}, 
    {name: "hey", link: "https://hey.xyz/u/saucy_block"}
  ];

  const [activeTab, setActiveTab] = useState(tabs[0]);

  return (
    <div className="w-full md:w-[549px] flex flex-col">
      <div className="w-full md:w-[100px] h-[40px] flex justify-between items-center mb-2 overflow-x-auto md:overflow-x-visible">
        {tabs.map((tab) => (
          <TabButton
            key={tab.name}
            label={tab.name}
            isActive={activeTab === tab}
            onClick={() => window.open(tab.link, '_blank')}
          />
        ))}
      </div>
      <Title activeTab={activeTab.name} />
      <DetailTexts />
    </div>
  );
}


const AddressDisplay = ({ ensName, address, disconnectWallet, connectWallet }: { ensName: string | null, address: string | null, disconnectWallet: () => void, connectWallet: () => void }) => {
  const displayText = ensName || (address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Connect wallet');
  const isConnected = Boolean(ensName || address);

  const handleClick = async () => {
    console.log("clicked");
    disconnectWallet();
  };
  
  return (
    <div 
      onClick={isConnected ? handleClick : connectWallet}
      className={`absolute z-[1000] top-4 right-4 text-white ${ibmPlexSans.className} text-sm text-[10px] font-extralight bg-black bg-opacity-50 px-3 py-1 rounded-[10px] flex items-center ${isConnected ? 'cursor-pointer hover:bg-opacity-70' : ''}`}
    >
      <span className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-400' : 'bg-red-500'}`}></span>
      {displayText}
      {isConnected && (
        <LogOut className="w-3 h-3 ml-2 text-white opacity-70 hover:opacity-100 z-1000" />
      )}
    </div>
  )
};


type TokenInfo = {
  iconUrl: string
  tokenName: string
  buttonText: string
  delegateToken: string
  address: string
  vote?: string
  proposal?: string
  balance?: string
  totalDelegated?: string
}

interface TransactionStatusProps {
  status: 'loading' | 'success' | 'error' | null
  txHash?: string
  errorMessage?: string
}

const TransactionStatus: React.FC<TransactionStatusProps> = ({ status, txHash, errorMessage }) => {
  if (!status) return null

  const statusMessages = {
    loading: {
      icon: <Loader2 className="animate-spin mr-2 h-5 w-5" />,
      text: "waiting for confirmation...",
      color: "text-blue-500"
    },
    success: {
      icon: <CheckCircle className="mr-2 h-5 w-5" />,
      text: "Transaction successful!",
      color: "text-green-500"
    },
    error: {
      icon: <XCircle className="mr-2 h-5 w-5" />,
      text: errorMessage || "Transaction failed. Please try again.",
      color: "text-red-500"
    }
  }

  const currentStatus = statusMessages[status]

  const handleCheckGovernance = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    window.open('https://app.aave.com/', '_blank', 'noopener,noreferrer')
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="fixed bottom-4 right-4 bg-white rounded-2xl shadow-lg p-4 max-w-md border border-gray-100 z-50"
    >
      <div className={`flex items-center ${currentStatus.color} mb-2`}>
        {currentStatus.icon}
        <span className="text-gray-600">{currentStatus.text}</span>
      </div>
      {status === 'success' && txHash && (
        <Button 
          onClick={handleCheckGovernance}
          className="w-full bg-blue-500 text-white hover:bg-blue-600 transition-colors duration-200"
        >
          Check on Aave Governance
        </Button>
      )}
    </motion.div>
  )
}


export default function AppLayout() {
  const [isCorrectChain, setIsCorrectChain] = useState(false)
  const [address, setAddress] = useState<Address | null>(null)
  const [ensName, setEnsName] = useState<string | null>(null)
  const [publicClient, setPublicClient] = useState<PublicClient | null>(null)
  const [wallet, setWallet] = useState<WalletClient | null>(null);
  const [tokenDataWithBalances, setTokenDataWithBalances] = useState<TokenInfo[]>([])
  const [useGasless, setUseGasless] = useState(true);
  const [sumDelegated, setSumDelegated] = useState(0);
  const [txStatus, setTxStatus] = useState<'loading' | 'success' | 'error' | null>(null)
  const [txHash, setTxHash] = useState<string | undefined>(undefined)
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined)

  async function setupWallet() {
    const publicClient = createPublicClient({
      chain: mainnet,
      transport: http("https://eth-mainnet.g.alchemy.com/v2/AHvTHUHmlCKWoa5hezH-MTrKWw_MjtUZ")
    })
    setPublicClient(publicClient)
    const wallet = createWalletClient({
      chain: mainnet,
      transport: custom((window as any).ethereum)
    })

    setWallet(wallet)
    
    try {
      const chainId = await wallet.getChainId()
      if (chainId !== mainnet.id) {
        await switchChain(wallet, { id: mainnet.id })
      }

      setIsCorrectChain(true)

      const [account] = await wallet.requestAddresses()
      setAddress(account)

      const name = await publicClient.getEnsName({ address: account })
      setEnsName(name)
    } catch (error) {
      console.error("Error setting up wallet:", error)
      setIsCorrectChain(false)
    }
  }

  useEffect(() => {
    if (!((window as any).ethereum)) return
    setupWallet()
  }, [])


  useEffect(() => {
    const isNoWallet = !address || !publicClient

    const fetchTokenData = async () => {
      let sumDelegated = 0
      const updatedTokenData = await Promise.all(
        tokenData.map(async (token) => {
          if (token.address) {
            const { vote, proposal } = isNoWallet ? {vote: 0, proposal: 0} : await getDelegatee(token.address, address)
            const balance = isNoWallet ? 0 : await getBalance(token.address, address)
            console.log("tokenData", token,balance)
            let totalDelegated = await getTotalDelegated(token.address)

            sumDelegated += Number(totalDelegated)
            
            return {
              ...token,
              vote: vote === zeroAddress ? "Not delegated" : vote,
              proposal: proposal === zeroAddress ? "Not delegated" : proposal,
              balance: formatEther(BigInt(balance)),
              totalDelegated: totalDelegated,
            }
          }
          return token
        })
      )
      setTokenDataWithBalances(updatedTokenData)
      setSumDelegated(sumDelegated)
    }

    fetchTokenData()
  }, [address, publicClient])
  

  const disconnectWallet = async () => {
    console.log("disconnecting wallet!!!!")
    const provider = (window as any).ethereum
    await provider.on("disconnect", () => {
      console.log("???")
    })
    setAddress(null)
    setEnsName(null)
    setWallet(null)
    // setPublicClient(null)
  }


  const handleDelegate = async (token: DelegateToken, isGasLess: boolean) => {
    if(!address || !publicClient) return
    const [isSufficient, isLimitReached] = await Promise.all([
      isSufficientBalance(address, token),
      isGasLessLimitReached(address)
    ]);

    if(isLimitReached) {
      setTxStatus('error')
      setErrorMessage('reached gasless limit')
      return
    }

    if(!isSufficient) {
      setTxStatus('error')
      setErrorMessage('insufficient balance')
      return
    }

    setTxStatus('loading')
    setErrorMessage(undefined)
    
    try {
      const hash = token ? await metaDelegate([token], wallet, isGasLess) : await metaDelegateALL(wallet, isGasLess)

      if(!hash) {
        setTxStatus('error')
        setErrorMessage('transaction generation failed')
        return
      }

      setTxHash(hash)
      
      // トランザクションの待機を追加
      await publicClient.waitForTransactionReceipt({ 
        hash: hash as `0x${string}`,
        confirmations: 1
      })
      
      setTxStatus('success')
      return hash
    } catch (error) {
      console.error("Delegation failed:", error)
      setTxStatus('error')
      // エラーメッセージの処理
      if (error instanceof Error) {
        if (error.message.includes('user rejected transaction')) {
          setErrorMessage('トランザクションがユーザーによってキャンセルされました')
        } else if (error.message.includes('insufficient funds')) {
          setErrorMessage('ガス代が不足しています')
        } else {
          setErrorMessage(error.message)
        }
      } else {
        setErrorMessage('予期せぬエラーが発生しました')
      }
    }
  }


  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${bgImageLink})`
        }}
      />
      <AddressDisplay ensName={ensName} address={address} disconnectWallet={disconnectWallet} connectWallet={setupWallet} />
      <div className="relative z-10 flex items-center justify-center min-h-screen w-full p-4 md:p-0">
        <div className="container w-full md:w-[1153px] md:h-[510px] mb-[20px]">
          <div className="flex flex-col md:flex-row h-full">
            <div className="w-full md:w-1/2 p-2 md:p-6 flex items-center justify-center mb-8 md:mb-0">
              <AboutUs />
            </div>
            <div className="w-full md:w-1/2 p-2 md:p-6">
            <div className="h-full flex items-center justify-center">
              <div className="w-full md:w-[548px] flex flex-col justify-between space-y-4 md:space-y-0">
                {
                  tokenDataWithBalances.map((token, index) => (
                    <Token 
                      key={index} 
                      info={token} 
                      handleDelegate={handleDelegate}
                      sumDelegated={sumDelegated}
                    />
                  ))
                }
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>
    <TransactionStatus 
      status={txStatus} 
      txHash={txHash} 
      errorMessage={errorMessage}
    />
    </div>
  )
}

