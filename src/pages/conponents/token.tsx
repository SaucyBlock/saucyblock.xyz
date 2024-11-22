import Image from 'next/image'
import { IBM_Plex_Sans } from 'next/font/google'

const ibmPlexSans = IBM_Plex_Sans({ 
  weight: ['200', '400', '500'],
  subsets: ['latin'],
})

function Token() {
  return (
    <div className={`bg-black text-white p-6 rounded-2xl w-[548px] h-[124px] flex flex-col justify-between ${ibmPlexSans.className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Image
            src="https://firebasestorage.googleapis.com/v0/b/ucai-d6677.appspot.com/o/aavetoken.png?alt=media&token=dce6b2e3-a5c7-445b-a3de-ee0d868775ab"
            alt="AAVE Logo"
            width={48}
            height={48}
            className="rounded-full mr-4"
          />
          <h1 className="text-[60px] font-extralight tracking-[-3.6px]">AAVE</h1>
        </div>
        <button className="w-[147px] h-[45px] rounded-[15px] bg-[rgba(22,22,22,0.20)] flex items-center justify-center">
          <span className="h-[33px] flex items-center text-white text-[14px] font-medium">
            delegate aAAVE
          </span>
        </button>
      </div>
      <div className="flex space-x-8 text-sm ml-[48px]">
        <p>
          <span className="text-gray-400">your balance:</span> 10000
        </p>
        <p>
          <span className="text-gray-400">total delegated to us:</span> 10000
        </p>
      </div>
    </div>
  )
}


export default function Tokens() {
  return (
    <div className="flex justify-center items-center h-screen">
      <Token />
    </div>
  )
}