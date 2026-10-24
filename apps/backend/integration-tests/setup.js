const { MetadataStorage } = require("@medusajs/framework/mikro-orm/core")

MetadataStorage.clear()

// HTTP suites sign many accounts up from 127.0.0.1: per-IP rate limits grow
// a hundred times under NODE_ENV=test only; per-identity limits stay as they
// are (lib/security/rate-limit/profiles.ts). Unit tests see the real limits.
if (process.env.TEST_TYPE?.startsWith("integration")) {
  process.env.RATE_LIMIT_RELAXED = "1"
}
