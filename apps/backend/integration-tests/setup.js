const { MetadataStorage } = require("@medusajs/framework/mikro-orm/core")

MetadataStorage.clear()

// HTTP suites sign many accounts up from 127.0.0.1: per-IP rate limits grow
// a hundred times under NODE_ENV=test only; per-identity limits stay as they
// are (lib/security/rate-limit/profiles.ts). Unit tests see the real limits.
if (process.env.TEST_TYPE?.startsWith("integration")) {
  process.env.RATE_LIMIT_RELAXED = "1"
  // Each test file counts in a Redis namespace of its own: back-to-back runs
  // would otherwise share an hour's sign-up limit and turn each other away
  process.env.QT_TEST_RUN = require("node:crypto").randomUUID().slice(0, 8)
}
