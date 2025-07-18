import { OptimizedDelegationSyncService } from "./src/services/delegationSync";
import { redis, REDIS_KEYS } from "./src/lib/redis";

async function testDelegationSync() {
  console.log("Starting OptimizedDelegationSyncService test...\n");

  try {
    const syncService = new OptimizedDelegationSyncService();
    
    // Test 1: Initial sync
    console.log("Test 1: Running initial delegation sync...");
    await syncService.syncDelegations();
    console.log("✓ Initial sync completed\n");

    // Test 2: Get active delegators
    console.log("Test 2: Fetching active delegators...");
    const activeDelegatorAddresses = await syncService.getActiveDelegators();
    console.log(`✓ Found ${activeDelegatorAddresses.length} active delegators`);
    
    if (activeDelegatorAddresses.length > 0) {
      console.log("\nSample delegator data:");
      // Get detailed info for the first delegator
      const sampleAddress = activeDelegatorAddresses[0];
      const _sampleInfo = await syncService.getDelegatorActiveDelegations(sampleAddress);
      const sampleInfo = _sampleInfo[0];
      
      if (sampleInfo) {
        console.log(`- Address: ${sampleInfo.delegator}`);
        console.log(`- Delegations: ${sampleInfo.delegationType}`);
        console.log(`- Token: ${sampleInfo.token}`);
        console.log(`- Token Name: ${sampleInfo.tokenName}`);
        console.log(`- Balance: ${sampleInfo.balance}`);
        console.log(`- Block Number: ${sampleInfo.blockNumber}`);
        console.log(`- Transaction Hash: ${sampleInfo.transactionHash}`);
        console.log(`- Timestamp: ${sampleInfo.timestamp}`);
      }
      
      // Show a few more addresses
      console.log("\nOther active delegators (showing first 5):");
      activeDelegatorAddresses.slice(0, 5).forEach((addr, index) => {
        console.log(`  ${index + 1}. ${addr}`);
      });
    }

    // Test 3: Get delegation stats
    console.log("\nTest 3: Getting delegation statistics...");
    const stats = await syncService.getDelegationStats();
    console.log(`✓ Total active delegators: ${stats.totalActiveDelegators}`);
    console.log(`✓ Delegatee address: ${stats.delegatee}`);
    
    console.log("\nLast analyzed blocks:");
    Object.entries(stats.lastAnalyzedBlocks).forEach(([token, block]) => {
      console.log(`- ${token}: ${block}`);
    });
    
    console.log("\nToken statistics:");
    Object.entries(stats.tokenStats).forEach(([token, tokenStats]) => {
      console.log(`- ${token}:`);
      console.log(`  * Unique delegators: ${tokenStats.delegators}`);
      console.log(`  * Total balance: ${tokenStats.totalBalance}`);
      console.log(`  * Voting power delegators: ${tokenStats.votingPowerDelegators}`);
      console.log(`  * Proposition power delegators: ${tokenStats.propositionPowerDelegators}`);
    });

    // Test 4: Test single delegator refresh
    if (activeDelegatorAddresses.length > 0) {
      console.log("\nTest 4: Testing single delegator refresh...");
      const testAddress = activeDelegatorAddresses[0];
      console.log(`Refreshing delegator: ${testAddress}`);
      await syncService.refreshSingleDelegator(testAddress);
      console.log("✓ Single delegator refresh completed");
    }

    // Test 5: Test incremental sync
    console.log("\nTest 5: Testing incremental sync...");
    const lastSyncedBlock = await redis.get(REDIS_KEYS.LAST_SYNCED_BLOCK);
    console.log(`Current last synced block: ${lastSyncedBlock}`);
    await syncService.syncDelegations();
    console.log("✓ Incremental sync completed");
    
    const newLastSyncedBlock = await redis.get(REDIS_KEYS.LAST_SYNCED_BLOCK);
    console.log(`New last synced block: ${newLastSyncedBlock}`);

    // Test 6: Verify Redis data structure
    console.log("\nTest 6: Verifying Redis data structure...");
    const delegationStates = await redis.hgetall(REDIS_KEYS.DELEGATION_STATE);
    console.log("🔍------", delegationStates);
    const stateCount = delegationStates ? Object.keys(delegationStates).length : 0;
    console.log(`✓ Delegation states in Redis: ${stateCount}`);
    
    // Check active delegators cache
    const activeDelegatorsCache = await redis.get(`active_delegators:0x08651EeE3b78254653062BA89035b8F8AdF924CE`);
    const cachedCount = activeDelegatorsCache ? (activeDelegatorsCache as any).length : 0;
    console.log(`✓ Cached active delegators: ${cachedCount}`);

    console.log("\n✅ All tests passed successfully!");

  } catch (error) {
    console.error("\n❌ Test failed with error:", error);
    if (error instanceof Error) {
      console.error("Stack trace:", error.stack);
    }
    process.exit(1);
  } finally {
    // Cleanup test data if needed
    console.log("\nTest completed.");
    process.exit(0);
  }
}

// Run the test
testDelegationSync();