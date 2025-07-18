import { NextApiRequest, NextApiResponse } from 'next';
import { OptimizedDelegationSyncService } from '@/services/delegationSync';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const syncService = new OptimizedDelegationSyncService();
    
    // Start sync process (non-blocking)
    syncService.syncDelegations().catch(console.error);
    
    res.status(200).json({ 
      message: 'Sync process started',
      note: 'This may take several minutes to complete'
    });
  } catch (error) {
    console.error('Error starting sync:', error);
    res.status(500).json({ error: 'Failed to start sync process' });
  }
}