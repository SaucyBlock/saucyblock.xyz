import { DelegationSyncService } from "./src/services/delegationSync";
import { redis, REDIS_KEYS } from "./src/lib/redis";

async function testDelegationSync() {
  console.log("Starting simplified DelegationSyncService test...\n");

  try {
    const syncService = new DelegationSyncService();
    
    // Test with a very recent block range to minimize data
    const currentBlock = 22930000; // Recent block
    const fromBlock = currentBlock - 1000; // Only sync last 1000 blocks
    
    console.log(`Test 1: Syncing recent blocks (${fromBlock} to ${currentBlock})...`);
    
    // Clear any existing data first
    await redis.del(REDIS_KEYS.LAST_SYNCED_BLOCK);
    await redis.del(REDIS_KEYS.DELEGATION_STATE);
    
    // Set the last synced block to limit the range
    await redis.set(REDIS_KEYS.LAST_SYNCED_BLOCK, fromBlock.toString());
    
    // Run sync
    await syncService.syncDelegations();
    console.log("✓ Sync completed\n");

    // Test 2: Get active delegators
    console.log("Test 2: Fetching active delegators...");
    const activeDelegators = await syncService.getActiveDelegators();
    console.log(`✓ Found ${activeDelegators.length} active delegators`);
    
    if (activeDelegators.length > 0) {
      console.log("\nSample delegator data:");
      const sample = activeDelegators[0];
      console.log(`- Address: ${sample.address}`);
      console.log(`- Delegations: ${sample.delegations.length}`);
      sample.delegations.forEach(d => {
        console.log(`  * ${d.tokenName} - Type: ${d.delegationType === 0 ? 'Voting' : 'Proposition'}, Balance: ${d.balance}`);
      });
    } else {
      console.log("No delegators found in this block range.");
    }

    // Test 3: Get delegation stats
    console.log("\nTest 3: Getting delegation statistics...");
    const stats = await syncService.getDelegationStats();
    console.log(`✓ Total delegators: ${stats.totalDelegators}`);
    
    if (stats.totalDelegators > 0) {
      console.log("\nToken statistics:");
      Object.entries(stats.tokenStats).forEach(([token, tokenStats]) => {
        if (tokenStats.delegators > 0) {
          console.log(`- ${token}:`);
          console.log(`  * Delegators: ${tokenStats.delegators}`);
          console.log(`  * Total balance: ${tokenStats.totalBalance}`);
          console.log(`  * Voting power delegators: ${tokenStats.votingPowerDelegators}`);
          console.log(`  * Proposition power delegators: ${tokenStats.propositionPowerDelegators}`);
        }
      });
    }

    console.log("\n✅ All tests completed successfully!");

  } catch (error) {
    console.error("\n❌ Test failed with error:", error);
    if (error instanceof Error) {
      console.error("Error details:", error.message);
      console.error("Stack:", error.stack);
    }
    process.exit(1);
  } finally {
    // Cleanup
    process.exit(0);
  }
}

// Run the test
testDelegationSync();