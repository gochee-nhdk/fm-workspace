import fastify from 'fastify';
import corsPlugin from '@fastify/cors';
import { getAllowedOrigins, isOriginAllowed } from '../config/cors.js';

async function runCorsTests() {
  console.log('=== FM WORKSPACE — CORS STANDARDIZATION & REGRESSION TESTS ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  // ── TEST 1: Production resolution of CLIENT_URL & ALLOWED_ORIGINS
  console.log('--- TEST GROUP 1: Environment Variable Resolution ---');
  {
    const origins = getAllowedOrigins({
      nodeEnv: 'production',
      isDesktop: false,
      clientUrl: 'https://farmers-market-procurement.vercel.app',
      allowedOrigins: 'https://staging.vercel.app, https://admin.farmersmarket.vn/',
    });

    assert(origins.includes('https://farmers-market-procurement.vercel.app'), '1.1: Configured CLIENT_URL is in allowed origins list');
    assert(origins.includes('https://staging.vercel.app'), '1.2: First entry of ALLOWED_ORIGINS is parsed and included');
    assert(origins.includes('https://admin.farmersmarket.vn'), '1.3: Second entry of ALLOWED_ORIGINS has whitespace and trailing slash stripped');
    assert(!origins.includes('http://localhost:5173'), '1.4: Local dev loopback origin is NOT included in production without desktop mode');
    assert(origins.length === 3, '1.5: Exactly 3 trusted production origins registered');
  }

  // ── TEST 2: Trailing slash handling and case normalization
  console.log('\n--- TEST GROUP 2: Normalization & Trailing Slashes ---');
  {
    const origins = getAllowedOrigins({
      nodeEnv: 'production',
      isDesktop: false,
      clientUrl: 'https://my-app.vercel.app///',
    });

    assert(origins.includes('https://my-app.vercel.app'), '2.1: Multiple trailing slashes on CLIENT_URL stripped cleanly');
    assert(isOriginAllowed('https://my-app.vercel.app', origins), '2.2: Standard origin header without slash matches normalized config');
    assert(isOriginAllowed('https://my-app.vercel.app/', origins), '2.3: Origin header with trailing slash matches normalized config');
    assert(isOriginAllowed(undefined, origins), '2.4: Requests without Origin header (curl, health checks) are allowed');
  }

  // ── TEST 3: Arbitrary and Attacker Origin Rejection
  console.log('\n--- TEST GROUP 3: Strict Origin Rejection ---');
  {
    const origins = getAllowedOrigins({
      nodeEnv: 'production',
      isDesktop: false,
      clientUrl: 'https://farmers-market-procurement.vercel.app',
    });

    assert(!isOriginAllowed('https://attacker.vercel.app', origins), '3.1: Arbitrary other vercel.app preview domain is rejected');
    assert(!isOriginAllowed('https://evil-hacker.com', origins), '3.2: Arbitrary external origin is rejected');
    assert(!isOriginAllowed('http://localhost:5173', origins), '3.3: Localhost is rejected in production if not explicitly configured');
    assert(!isOriginAllowed('https://farmers-market-procurement.vercel.app.evil.com', origins), '3.4: Subdomain prefix spoofing is rejected');
  }

  // ── TEST 4: Backward-compatible alias CORS_ORIGIN
  console.log('\n--- TEST GROUP 4: Backward Compatibility ---');
  {
    const originsWithAlias = getAllowedOrigins({
      nodeEnv: 'production',
      isDesktop: false,
      corsOrigin: 'https://legacy-env-origin.vercel.app',
    });

    assert(originsWithAlias.includes('https://legacy-env-origin.vercel.app'), '4.1: Fallback CORS_ORIGIN alias is accepted if set');
  }

  // ── TEST 5: Development & Desktop loopback support
  console.log('\n--- TEST GROUP 5: Development / Desktop Mode ---');
  {
    const devOrigins = getAllowedOrigins({
      nodeEnv: 'development',
      isDesktop: false,
    });
    assert(devOrigins.includes('http://localhost:5173'), '5.1: Dev mode includes localhost:5173 by default');
    assert(devOrigins.includes('http://127.0.0.1:5173'), '5.2: Dev mode includes 127.0.0.1:5173 by default');

    const desktopOrigins = getAllowedOrigins({
      nodeEnv: 'production',
      isDesktop: true,
    });
    assert(desktopOrigins.includes('http://localhost:5173'), '5.3: Production with isDesktop=true allows local UI loopback');
  }

  // ── TEST 6: Fastify Integration HTTP Injection
  console.log('\n--- TEST GROUP 6: Fastify HTTP Injection & Header Verification ---');
  {
    const productionVercelOrigin = 'https://farmers-market-procurement.vercel.app';
    const allowedSecondaryOrigin = 'https://admin.farmersmarket.vn';

    const testApp = fastify();
    const allowed = getAllowedOrigins({
      nodeEnv: 'production',
      isDesktop: false,
      clientUrl: productionVercelOrigin,
      allowedOrigins: allowedSecondaryOrigin,
    });

    await testApp.register(corsPlugin, {
      origin: (origin, cb) => {
        if (isOriginAllowed(origin, allowed)) {
          cb(null, true);
          return;
        }
        cb(null, false);
      },
      credentials: true,
    });

    testApp.get('/api/ping', async () => ({ status: 'pong' }));
    await testApp.ready();

    // 6.1: Configured Vercel production origin
    const resVercel = await testApp.inject({
      method: 'GET',
      url: '/api/ping',
      headers: { origin: productionVercelOrigin },
    });
    assert(
      resVercel.headers['access-control-allow-origin'] === productionVercelOrigin,
      '6.1: Fastify returns access-control-allow-origin matching configured Vercel origin'
    );
    assert(
      resVercel.headers['access-control-allow-credentials'] === 'true',
      '6.2: Credentials header set for allowed origin'
    );

    // 6.3: Configured secondary origin from ALLOWED_ORIGINS
    const resSecondary = await testApp.inject({
      method: 'GET',
      url: '/api/ping',
      headers: { origin: allowedSecondaryOrigin },
    });
    assert(
      resSecondary.headers['access-control-allow-origin'] === allowedSecondaryOrigin,
      '6.3: Fastify returns access-control-allow-origin matching secondary ALLOWED_ORIGINS origin'
    );

    // 6.4: Arbitrary external origin rejected
    const resAttacker = await testApp.inject({
      method: 'GET',
      url: '/api/ping',
      headers: { origin: 'https://malicious-site.example.com' },
    });
    assert(
      !resAttacker.headers['access-control-allow-origin'],
      '6.4: Fastify omits access-control-allow-origin for unauthorized external origin'
    );

    // 6.5: Arbitrary Vercel preview domain rejected
    const resAttackerVercel = await testApp.inject({
      method: 'GET',
      url: '/api/ping',
      headers: { origin: 'https://attacker-fake.vercel.app' },
    });
    assert(
      !resAttackerVercel.headers['access-control-allow-origin'],
      '6.5: Fastify omits access-control-allow-origin for untrusted vercel.app domain'
    );

    // 6.6: No origin header (curl, health check) permitted
    const resNoOrigin = await testApp.inject({
      method: 'GET',
      url: '/api/ping',
    });
    assert(resNoOrigin.statusCode === 200, '6.6: Request without origin header executes successfully');

    await testApp.close();
  }

  console.log(`\n=== CORS TESTS RESULT: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runCorsTests().catch((err) => {
  console.error('Fatal CORS test runner error:', err);
  process.exit(1);
});
