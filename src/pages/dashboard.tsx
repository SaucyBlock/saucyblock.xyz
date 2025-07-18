import { useEffect, useState } from 'react';
import { GetServerSideProps } from 'next';
import Head from 'next/head';

interface DelegationData {
  stats: {
    totalActiveDelegators: number;
    delegatee: string;
    lastAnalyzedBlocks: Record<string, number>;
    tokenStats: Record<string, {
      delegators: number;
      totalBalance: string;
      votingPowerDelegators: number;
      propositionPowerDelegators: number;
      delegateeVotingPower: string;
      delegateePropositionPower: string;
    }>;
  };
  lastSyncBlock: string | null;
  totalDelegators: number;
  delegatorDetails: Array<{
    address: string;
    totalVotes: number;
    delegationsByToken: Record<string, { voting: boolean; proposition: boolean; balance: string }>;
    tokenBalances: Record<string, string>;
    delegations: Array<{
      tokenName: string;
      delegationType: string;
      balance: string;
    }>;
  }>;
  hasMore: boolean;
}

export default function Dashboard() {
  const [data, setData] = useState<DelegationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [lastSyncStarted, setLastSyncStarted] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const formatTimeAgo = (date: Date, referenceTime?: Date) => {
    const now = referenceTime || new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/delegations');
      if (!response.ok) throw new Error('Failed to fetch data');
      const newData = await response.json();
      setData(newData);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
      setIsLoading(false);
    }
  };

  const triggerSync = async () => {
    try {
      setIsSyncing(true);
      setLastSyncStarted(new Date());
      const response = await fetch('/api/sync', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to start sync');
      
      // Wait a bit then refresh data
      setTimeout(() => {
        fetchData();
        setIsSyncing(false);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    if (autoRefresh) {
      const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') {
        if (e.metaKey || e.ctrlKey) {
          // Command+R or Ctrl+R - trigger sync
          e.preventDefault();
          triggerSync();
        } else {
          // Just R - toggle auto-refresh
          setAutoRefresh(prev => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  // Update current time every second for live sync elapsed time
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div style={{ fontFamily: 'monospace', padding: '20px', backgroundColor: '#000', color: '#0f0', minHeight: '100vh' }}>
        <pre>Loading...</pre>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ fontFamily: 'monospace', padding: '20px', backgroundColor: '#000', color: '#f00', minHeight: '100vh' }}>
        <pre>Error: {error}</pre>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ fontFamily: 'monospace', padding: '20px', backgroundColor: '#000', color: '#0f0', minHeight: '100vh' }}>
        <pre>No data available</pre>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Delegation Dashboard</title>
      </Head>
      <div style={{ 
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', 
        padding: '0', 
        backgroundColor: '#0f0f0f', 
        color: '#e5e5e5', 
        minHeight: '100vh',
        fontSize: '16px',
        lineHeight: '1.6'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          backgroundColor: '#191919',
          minHeight: '100vh',
          boxShadow: '0 0 0 1px #2d2d2d'
        }}>
        {/* Header */}
        <div style={{ padding: '48px 96px 0px', borderBottom: '1px solid #2d2d2d' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <h1 style={{ 
              fontSize: '40px', 
              fontWeight: '700', 
              margin: '0',
              color: '#ffffff'
            }}>
              🏛️ AAVE Delegation Dashboard
            </h1>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={fetchData}
                disabled={isLoading}
                style={{
                  backgroundColor: isLoading ? '#404040' : '#2d2d2d',
                  color: isLoading ? '#a0a0a0' : '#e5e5e5',
                  border: '1px solid #404040',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.backgroundColor = '#404040';
                    e.currentTarget.style.borderColor = '#606060';
                  }
                }}
                onMouseOut={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.backgroundColor = '#2d2d2d';
                    e.currentTarget.style.borderColor = '#404040';
                  }
                }}
              >
                {isLoading ? '🔄' : '📊'} Refresh Data
              </button>
              <button
                onClick={triggerSync}
                disabled={isSyncing}
                style={{
                  backgroundColor: isSyncing ? '#404040' : '#3182ce',
                  color: '#ffffff',
                  border: '1px solid #3182ce',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: isSyncing ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  if (!isSyncing) {
                    e.currentTarget.style.backgroundColor = '#2563eb';
                    e.currentTarget.style.borderColor = '#2563eb';
                  }
                }}
                onMouseOut={(e) => {
                  if (!isSyncing) {
                    e.currentTarget.style.backgroundColor = '#3182ce';
                    e.currentTarget.style.borderColor = '#3182ce';
                  }
                }}
              >
                {isSyncing ? '⏳' : '🔄'} Sync Events
              </button>
            </div>
          </div>
          <div style={{ 
            fontSize: '16px', 
            color: '#a0a0a0', 
            marginBottom: '32px',
            display: 'flex',
            gap: '24px',
            flexWrap: 'wrap'
          }}>
            <div><strong>Delegatee:</strong> <code style={{ background: '#2d2d2d', padding: '2px 6px', borderRadius: '4px', fontSize: '14px', color: '#e5e5e5' }}>{data.stats.delegatee}</code></div>
            <div><strong>Last Sync Block:</strong> {data.lastSyncBlock || 'N/A'}</div>
            <div><strong>Total Active Delegators:</strong> {data.stats.totalActiveDelegators}</div>
          </div>
        </div>

        {/* Delegatee Power Section */}
        <div style={{ padding: '48px 96px' }}>
          <h2 style={{ 
            fontSize: '24px', 
            fontWeight: '600', 
            margin: '0 0 24px 0',
            color: '#ffffff'
          }}>
            💪 Current Delegated Power
          </h2>
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '16px',
            marginBottom: '24px'
          }}>
            {Object.entries(data.stats.tokenStats).map(([tokenName, tokenStat]) => {
              const votingPower = parseFloat(tokenStat.delegateeVotingPower || '0');
              const propPower = parseFloat(tokenStat.delegateePropositionPower || '0');
              return (
                <div key={tokenName} style={{
                  background: '#2d2d2d',
                  border: '1px solid #404040',
                  borderRadius: '8px',
                  padding: '20px'
                }}>
                  <h3 style={{ 
                    fontSize: '18px', 
                    fontWeight: '600', 
                    margin: '0 0 12px 0',
                    color: '#ffffff'
                  }}>
                    {tokenName}
                  </h3>
                  <div style={{ fontSize: '14px', color: '#a0a0a0' }}>
                    <div style={{ marginBottom: '8px' }}>
                      <span style={{ fontWeight: '500' }}>Voting Power:</span> {votingPower.toFixed(6)}
                    </div>
                    <div>
                      <span style={{ fontWeight: '500' }}>Proposition Power:</span> {propPower.toFixed(6)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Active Delegators Section */}
        <div style={{ padding: '0 96px 48px' }}>
          <h2 style={{ 
            fontSize: '24px', 
            fontWeight: '600', 
            margin: '0 0 24px 0',
            color: '#ffffff'
          }}>
            👥 Active Delegators ({data.delegatorDetails.length})
          </h2>
          <div style={{ 
            background: '#2d2d2d',
            border: '1px solid #404040',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '60px 1fr 120px 120px 120px 200px',
              gap: '16px',
              padding: '16px 20px',
              background: '#1a1a1a',
              borderBottom: '1px solid #404040',
              fontSize: '14px',
              fontWeight: '600',
              color: '#a0a0a0'
            }}>
              <div>#</div>
              <div>Address</div>
              <div>AAVE</div>
              <div>stkAAVE</div>
              <div>aAAVE</div>
              <div>Delegations</div>
            </div>
            {data.delegatorDetails.map((delegator, index) => {
              const delegationInfo = Object.entries(delegator.delegationsByToken)
                .map(([token, info]) => {
                  const types = [];
                  if (info.voting) types.push('V');
                  if (info.proposition) types.push('P');
                  return `${token}(${types.join('+')})`;
                })
                .join(' ');
              
              const aaveBalance = delegator.tokenBalances.AAVE ? parseFloat(delegator.tokenBalances.AAVE).toFixed(6) : '0.000000';
              const stkAAVEBalance = delegator.tokenBalances.stkAAVE ? parseFloat(delegator.tokenBalances.stkAAVE).toFixed(6) : '0.000000';
              const aAAVEBalance = delegator.tokenBalances.aAAVE ? parseFloat(delegator.tokenBalances.aAAVE).toFixed(6) : '0.000000';
              
              return (
                <div key={delegator.address} style={{
                  display: 'grid',
                  gridTemplateColumns: '60px 1fr 120px 120px 120px 200px',
                  gap: '16px',
                  padding: '16px 20px',
                  borderBottom: index < data.delegatorDetails.length - 1 ? '1px solid #404040' : 'none',
                  fontSize: '14px',
                  alignItems: 'center'
                }}>
                  <div style={{ color: '#a0a0a0' }}>{index + 1}</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '12px', color: '#e5e5e5' }}>{delegator.address}</div>
                  <div style={{ fontFamily: 'monospace', textAlign: 'right', color: '#e5e5e5' }}>{aaveBalance}</div>
                  <div style={{ fontFamily: 'monospace', textAlign: 'right', color: '#e5e5e5' }}>{stkAAVEBalance}</div>
                  <div style={{ fontFamily: 'monospace', textAlign: 'right', color: '#e5e5e5' }}>{aAAVEBalance}</div>
                  <div style={{ fontSize: '12px', color: '#a0a0a0' }}>{delegationInfo}</div>
                </div>
              );
            })}
          </div>
          {data.hasMore && (
            <div style={{ 
              textAlign: 'center', 
              padding: '16px', 
              color: '#a0a0a0',
              fontStyle: 'italic'
            }}>
              ... and {data.totalDelegators - data.delegatorDetails.length} more delegators
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ 
          padding: '24px 96px 48px',
          borderTop: '1px solid #2d2d2d',
          background: '#1a1a1a',
          fontSize: '14px',
          color: '#a0a0a0'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong>Controls:</strong> Press 'R' to toggle auto-refresh | Press 'Cmd+R' to sync
            </div>
            <div>
              <strong>Last updated:</strong> {lastUpdated ? formatTimeAgo(lastUpdated, currentTime) : 'Never'}
              {lastSyncStarted && (
                <span> | <strong>Event analysis started:</strong> {formatTimeAgo(lastSyncStarted, currentTime)}</span>
              )}
            </div>
          </div>
        </div>
        </div>
        
        {/* Loading Indicator */}
        {(isLoading || isSyncing) && (
          <div style={{
            position: 'fixed',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#2d2d2d',
            color: '#e5e5e5',
            padding: '16px 24px',
            borderRadius: '8px',
            fontSize: '14px',
            border: '1px solid #404040',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              width: '20px',
              height: '20px',
              border: '2px solid #404040',
              borderTop: '2px solid #60a5fa',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
            <span style={{ fontWeight: '500' }}>
              {isSyncing ? '🔄 Analyzing blockchain events...' : '📊 Loading dashboard...'}
            </span>
          </div>
        )}
        
        {/* CSS for spinner animation */}
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    props: {}
  };
};