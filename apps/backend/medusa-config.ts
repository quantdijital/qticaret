import { defineConfig, loadEnv } from "@medusajs/framework/utils"
import { isLocalEnv, parseEnv, s3Settings } from "./src/lib/env"
import { DEFAULT_LOG_LEVEL, MedusaPinoLogger, baseLogger, logger } from "./src/lib/logging"
import { lockingModules, tenantNamespace } from "./src/lib/redis"

loadEnv(process.env["NODE_ENV"] ?? "development", process.cwd())

const env = parseEnv()
// Redis keys of this tenant, a test run apart from dev (lib/redis/namespace.ts)
const namespace = tenantNamespace(env.DATABASE_URL, env.NODE_ENV)
// Tests keep files local (CI has no object store); elsewhere S3 when set,
// which the env schema requires once deployed (adr/0014)
const s3 = env.NODE_ENV === "test" ? null : s3Settings(env)
if (!s3 && !isLocalEnv(env)) {
  // NODE_ENV unset counts as deployed: files on local disk are lost on
  // restart and served unauthenticated under /static (F16 sets NODE_ENV)
  logger.warn({ event: "files.local_disk", nodeEnv: env.NODE_ENV ?? null })
}

module.exports = defineConfig({
  // Core, modules and scripts log through the platform logger: JSON,
  // redacted, with the request ID (docs/10)
  logger: new MedusaPinoLogger(baseLogger, env.LOG_LEVEL ?? DEFAULT_LOG_LEVEL),
  projectConfig: {
    databaseUrl: env.DATABASE_URL,
    // Session store for cookie auth (adr/0004); without it sessions live in
    // process memory, so the env schema requires it when deployed.
    ...(env.REDIS_URL ? { redisUrl: env.REDIS_URL } : {}),
    // Customer web sessions: never readable by scripts, sent on top-level
    // navigation only, HTTPS-only unless explicitly local (adr/0004; CSRF in
    // F2.10). Session lifetime is Medusa's default, stated explicitly: 10
    // hours, shorter than the 1-day bearer token.
    cookieOptions: { httpOnly: true, sameSite: "lax", secure: !isLocalEnv(env) },
    sessionOptions: { ttl: 10 * 60 * 60 * 1000 },
    http: {
      storeCors: env.STORE_CORS,
      adminCors: env.ADMIN_CORS,
      authCors: env.AUTH_CORS,
      jwtSecret: env.JWT_SECRET,
      cookieSecret: env.COOKIE_SECRET,
    },
  },
  // F4.8 (ADR-0025): gift cards and store credit; its routes answer only with
  // the shop's `promotions.gift_cards` flag on (src/api/http/gift-card-routes.ts)
  plugins: [{ resolve: "@medusajs/loyalty-plugin", options: {} }],
  modules: [
    { resolve: "./src/modules/tr-address" },
    { resolve: "./src/modules/url-registry" },
    { resolve: "./src/modules/audit-log" },
    { resolve: "./src/modules/product-attributes" },
    { resolve: "./src/modules/catalog-extension" },
    { resolve: "./src/modules/seo-meta" },
    { resolve: "./src/modules/brands" },
    { resolve: "./src/modules/content" },
    { resolve: "./src/modules/seo-sitemaps" },
    { resolve: "./src/modules/seo-advisor" },
    { resolve: "./src/modules/media" },
    { resolve: "./src/modules/stock-ledger" },
    { resolve: "./src/modules/price-history" },
    {
      resolve: "./src/modules/seo-redirects",
      options: {
        redisUrl: env.REDIS_URL,
        versionKey: `qt:redirects:${namespace}:version`,
        resolutionsVersionKey: `qt:seo:${namespace}:resolutions`,
      },
    },
    { resolve: "./src/modules/async-job" },
    {
      resolve: "./src/modules/platform-settings",
      options: {
        redisUrl: env.REDIS_URL,
        versionKey: `qt:settings:${namespace}:version`,
      },
    },
    // adr/0027: the shop's provider accounts, sealed with their own key
    {
      resolve: "./src/modules/integration-credentials",
      options: {
        encryptionKey: env.CREDENTIALS_ENCRYPTION_KEY,
        redisUrl: env.REDIS_URL,
        versionKey: `qt:credentials:${namespace}:version`,
      },
    },
    {
      resolve: "./src/modules/billing-profile",
      options: { encryptionKey: env.PII_ENCRYPTION_KEY, hashKey: env.PII_HASH_KEY },
    },
    // Locks shared by every process of the tenant (adr/0020)
    ...lockingModules(env.REDIS_URL, namespace),
    // Without it Medusa keeps files on local disk (dev and test only)
    ...(s3
      ? [
          {
            resolve: "@medusajs/medusa/file",
            options: {
              providers: [
                {
                  resolve: "@medusajs/medusa/file-s3",
                  id: "s3",
                  options: {
                    file_url: s3.fileUrl,
                    access_key_id: s3.accessKeyId,
                    secret_access_key: s3.secretAccessKey,
                    region: s3.region,
                    bucket: s3.bucket,
                    ...(s3.endpoint ? { endpoint: s3.endpoint } : {}),
                    // Private results are fetched with links that live 5 minutes
                    download_file_duration: 300,
                    additional_client_config: { forcePathStyle: true },
                  },
                },
              ],
            },
          },
        ]
      : []),
  ],
})
