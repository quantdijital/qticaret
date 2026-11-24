/* global jest */
const { MetadataStorage } = require("@medusajs/framework/mikro-orm/core")

MetadataStorage.clear()

// HTTP suites sign many accounts up from 127.0.0.1: per-IP rate limits grow
// a hundred times under NODE_ENV=test only; per-identity limits stay as they
// are (lib/security/rate-limit/profiles.ts). Unit tests see the real limits.
if (process.env.TEST_TYPE?.startsWith("integration")) {
  process.env.RATE_LIMIT_RELAXED = "1"
  // Each test file has a Redis namespace of its own (locks, counters, cache
  // versions): back-to-back runs would otherwise share an hour's sign-up
  // limit, and two runs at once would wait on each other's locks
  process.env.QT_TEST_RUN = require("node:crypto").randomUUID().slice(0, 8)
  // Staff sign in with a password alone, as before 2FA; the 2FA suite turns
  // it on (adr/0040). Locally only: ignored where the shop runs
  process.env.ADMIN_MFA ??= "off"
  // No connect to [::1]:55432, which can connect a socket to itself, and a
  // connect left unanswered is opened again (integration-tests/database.js)
  require("./database").setUpTestDatabaseConnections()
  // A fresh connection per test request: a spec that works a proof of work
  // between calls can idle past the server's 5 s keep-alive on a slow
  // runner, and the next call on the socket the server just closed gets
  // ECONNRESET (storefront-client-ip.spec.ts in CI)
  const http = require("node:http")
  // Cloudflare Turnstile (adr/0044 Ek 2026-11-24): every test request carries
  // the token a test site key's widget gives, which the always-pass test
  // secret (the default here) takes; a spec that sends the header itself
  // keeps its own value (an empty one for "no token")
  class TurnstileAgent extends http.Agent {
    addRequest(req, options) {
      if (!req.hasHeader("x-turnstile-token")) {
        req.setHeader("x-turnstile-token", "XXXX.DUMMY.TOKEN.XXXX")
      }
      super.addRequest(req, options)
    }
  }
  http.globalAgent = new TurnstileAgent({ keepAlive: false })
  // An HTTP spec file's database starts as a copy of the migrated template,
  // when the run has one (integration-tests/template/README.md)
  require("./template/runner").useTemplateDatabase(jest)
}
