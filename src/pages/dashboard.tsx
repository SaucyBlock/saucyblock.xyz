import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DelegateToken } from '@/delegate';

interface LogArgs {
  delegator: string;
  delegatee: string;
  delegationType: number;
  token: DelegateToken;
  balance?: string;
  blockNumber: number;
}

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

export default function LogDashboard() {
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [logs, setLogs] = useState<LogArgs[]>([]);

  useEffect(() => {
    const fetchLogs = async () => {
      const logs = await fetch("/api/getLogs");
      const logsArray = await logs.json();
      console.log(logsArray);
      setLogs(logsArray as LogArgs[]);
    }
    fetchLogs();
  }, []);

  const handleAction = (action: string, log: LogArgs) => {
    console.log(`${action} clicked for:`, log);
    // ここに各アクションの処理を実装します
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRows(logs.map((_, index) => index));
    } else {
      setSelectedRows([]);
    }
  };

  const handleSelectRow = (index: number, checked: boolean) => {
    if (checked) {
      setSelectedRows([...selectedRows, index]);
    } else {
      setSelectedRows(selectedRows.filter(i => i !== index));
    }
  };

  const isAllSelected = selectedRows.length === logs.length;

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-bold mb-5 text-white">Log Dashboard</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]">
              <Checkbox
                checked={isAllSelected}
                onCheckedChange={handleSelectAll}
              />
            </TableHead>
            <TableHead className="text-white">Delegator</TableHead>
            <TableHead className="text-white">Delegation Type</TableHead>
            <TableHead className="text-white">Token</TableHead>
            <TableHead className="text-white">Balance</TableHead>
            <TableHead className="text-white">Block Number</TableHead>
            <TableHead className="text-white">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log, index) => (
            <TableRow key={index}>
              <TableCell>
                <Checkbox
                  checked={selectedRows.includes(index)}
                  onCheckedChange={(checked: boolean) => handleSelectRow(index, checked)}
                />
              </TableCell>
              <TableCell className="text-white">{log.delegator}</TableCell>
              <TableCell className="text-white">{log.delegationType === 1 ? "Voting Power" : "Propose Power"}</TableCell>
              <TableCell>
                <div className="flex items-center space-x-2">
                  {tokenData.find(token => token.address === log.token) && (
                    <Image
                      src={tokenData.find(token => token.address === log.token)!.iconUrl}
                      alt={tokenData.find(token => token.address === log.token)!.tokenName}
                      width={24}
                      height={24}
                    />
                  )}
                  <span className="text-white">{tokenData.find(token => token.address === log.token)?.tokenName}</span>
                </div>
              </TableCell>
              <TableCell className="text-white">{log.balance || 'N/A'}</TableCell>
              <TableCell className="text-white">{log.blockNumber}</TableCell>
              <TableCell>
                <div className="flex space-x-2">
                  <Button
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                    onClick={() => window.open(`https://etherscan.io/address/${log.delegator}`, '_blank')}
                  >
                    Scan
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

