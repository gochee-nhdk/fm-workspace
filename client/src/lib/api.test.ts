import { resolveApiBaseUrl } from './api.js';

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
  } else {
    console.error(`[FAIL] ${testName}`);
    process.exit(1);
  }
}

console.log('=== CLIENT API URL RESOLUTION TESTS ===\n');

// 1. Full origin without /api
assert(
  resolveApiBaseUrl('https://fm-backend.onrender.com') === 'https://fm-backend.onrender.com/api',
  '1. Origin without /api gets /api appended'
);

// 2. Full origin with trailing slash
assert(
  resolveApiBaseUrl('https://fm-backend.onrender.com/') === 'https://fm-backend.onrender.com/api',
  '2. Origin with trailing slash gets /api appended cleanly without double slashes'
);

// 3. Full origin already containing /api
assert(
  resolveApiBaseUrl('https://fm-backend.onrender.com/api') === 'https://fm-backend.onrender.com/api',
  '3. Origin with /api preserves exact /api path'
);

// 4. Full origin with /api and trailing slash (critical edge case!)
assert(
  resolveApiBaseUrl('https://fm-backend.onrender.com/api/') === 'https://fm-backend.onrender.com/api',
  '4. Origin with /api/ strips trailing slash and does NOT duplicate to /api/api'
);

// 5. Multiple trailing slashes
assert(
  resolveApiBaseUrl('https://fm-backend.onrender.com/api///') === 'https://fm-backend.onrender.com/api',
  '5. Multiple trailing slashes stripped safely'
);

// 6. Local development URLs
assert(
  resolveApiBaseUrl('http://localhost:3000') === 'http://localhost:3000/api',
  '6. Localhost URL gets /api appended'
);
assert(
  resolveApiBaseUrl('http://localhost:3000/api') === 'http://localhost:3000/api',
  '7. Localhost with /api preserved'
);

// 8. Relative paths
assert(
  resolveApiBaseUrl('/api') === '/api',
  '8. Relative /api preserved'
);
assert(
  resolveApiBaseUrl('/api/') === '/api',
  '9. Relative /api/ normalized to /api'
);

// 10. Empty or undefined defaults to /api
assert(
  resolveApiBaseUrl('') === '/api',
  '10. Empty string defaults to /api'
);
assert(
  resolveApiBaseUrl('   ') === '/api',
  '11. Whitespace-only string defaults to /api'
);
assert(
  resolveApiBaseUrl(undefined) === '/api',
  '12. Undefined defaults to /api'
);

console.log('\n=== ALL 12 API URL RESOLUTION TESTS PASSED! ===');
