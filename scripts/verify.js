// Cross-platform automated verification script (Node.js)
// Tests: 200 OK, 400 Validation, 404 Not Found, 409 Conflict, and Parallel Concurrent Updates

const BASE_URL = 'http://localhost:5000/dishes';

async function runVerification() {
  console.log('=== Starting Dish Dashboard API Verification ===\n');

  // 1. GET /dishes
  console.log('[Test 1] GET /dishes');
  const getRes = await fetch(BASE_URL);
  const dishes = await getRes.json();
  if (getRes.status === 200 && Array.isArray(dishes)) {
    console.log(`✓ Passed: 200 OK (${dishes.length} dishes returned)`);
  } else {
    console.error(`✗ Failed: Expected 200, got ${getRes.status}`);
  }

  const dish1 = dishes.find((d) => d.dishId === '1') || { version: 1 };
  const initialVersion = dish1.version;
  console.log(`Dish 1 starting version: ${initialVersion}\n`);

  // 2. Valid PATCH update
  console.log('[Test 2] Valid PATCH update on Dish 1');
  const patchRes = await fetch(`${BASE_URL}/1`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dishName: 'Jeera Rice Verified',
      isPublished: true,
      expectedVersion: initialVersion
    })
  });
  const patched = await patchRes.json();
  if (patchRes.status === 200 && patched.version === initialVersion + 1) {
    console.log(`✓ Passed: 200 OK (Version incremented to ${patched.version})\n`);
  } else {
    console.error(`✗ Failed: Expected 200 with version increment, got ${patchRes.status}\n`);
  }

  const currentVersion = patched.version;

  // 3. 409 Conflict with stale version
  console.log('[Test 3] 409 Conflict with stale expectedVersion');
  const conflictRes = await fetch(`${BASE_URL}/1`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dishName: 'Stale Edit Attempt',
      isPublished: true,
      expectedVersion: initialVersion // Stale version
    })
  });
  const conflictData = await conflictRes.json();
  if (conflictRes.status === 409) {
    console.log(`✓ Passed: 409 Conflict returned: "${conflictData.error}"\n`);
  } else {
    console.error(`✗ Failed: Expected 409, got ${conflictRes.status}\n`);
  }

  // 4. 400 Bad Request on empty dish name
  console.log('[Test 4] 400 Bad Request on empty dishName');
  const emptyRes = await fetch(`${BASE_URL}/1`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dishName: '   ',
      isPublished: false,
      expectedVersion: currentVersion
    })
  });
  const emptyData = await emptyRes.json();
  if (emptyRes.status === 400) {
    console.log(`✓ Passed: 400 Bad Request returned: "${emptyData.error}"\n`);
  } else {
    console.error(`✗ Failed: Expected 400, got ${emptyRes.status}\n`);
  }

  // 5. 404 Not Found on unknown dishId
  console.log('[Test 5] 404 Not Found on non-existent dishId');
  const notFoundRes = await fetch(`${BASE_URL}/99999`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dishName: 'Ghost Dish',
      isPublished: false,
      expectedVersion: 1
    })
  });
  const notFoundData = await notFoundRes.json();
  if (notFoundRes.status === 404) {
    console.log(`✓ Passed: 404 Not Found returned: "${notFoundData.error}"\n`);
  } else {
    console.error(`✗ Failed: Expected 404, got ${notFoundRes.status}\n`);
  }

  // 6. Concurrency: Two parallel requests with the same expectedVersion
  console.log('[Test 6] Concurrent Writes: 2 simultaneous PATCH requests with the same version');
  const [resA, resB] = await Promise.all([
    fetch(`${BASE_URL}/1`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dishName: 'Parallel Request Alpha',
        isPublished: true,
        expectedVersion: currentVersion
      })
    }),
    fetch(`${BASE_URL}/1`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dishName: 'Parallel Request Beta',
        isPublished: true,
        expectedVersion: currentVersion
      })
    })
  ]);

  const statusA = resA.status;
  const statusB = resB.status;
  console.log(`Request Alpha status: ${statusA}, Request Beta status: ${statusB}`);

  if (
    (statusA === 200 && statusB === 409) ||
    (statusA === 409 && statusB === 200)
  ) {
    console.log('✓ Passed: Exactly one request succeeded (200) and the other received 409 Conflict\n');
  } else {
    console.error(`✗ Unexpected race result: ${statusA} / ${statusB}\n`);
  }

  console.log('=== All Automated Checks Complete ===');
}

runVerification().catch(console.error);
