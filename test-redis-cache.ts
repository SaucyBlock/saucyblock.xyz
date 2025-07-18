import { DelegationSyncService } from "./src/services/delegationSync";

async function testRedisCaching() {
  const syncService = new DelegationSyncService();

  console.log("Testing Redis caching for delegatorArray...\n");

  // Test 1: Get cached delegator array for all delegators
  console.log("1. Testing getCachedDelegatorArray (all delegators):");
  const allDelegators = await syncService.getCachedDelegatorArray();
  console.log(`   Found ${allDelegators.length} total cached delegators`);
  if (allDelegators.length > 0) {
    console.log(`   First delegator: ${allDelegators[0]}`);
  }

  // Test 2: Get cached delegator array for specific token
  console.log("\n2. Testing getCachedDelegatorArray (AAVE token):");
  const aaveDelegators = await syncService.getCachedDelegatorArray("AAVE");
  console.log(`   Found ${aaveDelegators.length} AAVE delegators`);

  // Test 3: Get cached delegator info for a specific delegator
  if (allDelegators.length > 0) {
    console.log("\n3. Testing getCachedDelegatorInfo:");
    const delegatorInfo = await syncService.getCachedDelegatorInfo(allDelegators[0]);
    if (delegatorInfo) {
      console.log(`   Delegator: ${delegatorInfo.address}`);
      console.log(`   Delegations: ${delegatorInfo.delegations.length}`);
      delegatorInfo.delegations.forEach(d => {
        console.log(`     - ${d.tokenName}: ${d.balance} (Type: ${d.delegationType})`);
      });
    } else {
      console.log("   No cached info found for this delegator");
    }
  }

  // Test 4: Get active delegators (uses cache internally)
  console.log("\n4. Testing getActiveDelegators:");
  const activeDelegators = await syncService.getActiveDelegators();
  console.log(`   Found ${activeDelegators.length} active delegators`);

  console.log("\nRedis caching test completed!");
}

// Run the test
testRedisCaching().catch(console.error);