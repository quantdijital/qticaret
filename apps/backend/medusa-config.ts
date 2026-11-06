import {
  ContainerRegistrationKeys,
  Modules,
  defineConfig,
  loadEnv,
} from "@medusajs/framework/utils"
import { customerAuthProviders } from "./src/lib/auth/providers"
import { isLocalEnv, parseEnv, s3Settings } from "./src/lib/env"
import { warnFakeProviders } from "./src/lib/fake-providers"
import { DEFAULT_LOG_LEVEL, MedusaPinoLogger, baseLogger, logger } from "./src/lib/logging"
import { lockingModules, tenantNamespace } from "./src/lib/redis"

loadEnv(process.env["NODE_ENV"] ?? "development", process.cwd())

const env = parseEnv()
const auth = customerAuthProviders(env)
// Redis keys of this tenant; a test file apart from dev and from every other
// test file, also one of another run at the same time (lib/redis/namespace.ts)
const namespace = tenantNamespace(env.DATABASE_URL, env.NODE_ENV, process.env["QT_TEST_RUN"])
// Tests keep files local (CI has no object store); elsewhere S3 when set,
// which the env schema requires once deployed (adr/0014)
const s3 = env.NODE_ENV === "test" ? null : s3Settings(env)
if (!s3 && !isLocalEnv(env)) {
  // NODE_ENV unset counts as deployed: files on local disk are lost on
  // restart and served unauthenticated under /static (F16 sets NODE_ENV)
  logger.warn({ event: "files.local_disk", nodeEnv: env.NODE_ENV ?? null })
}
// A fake provider server set (development only; refused when deployed): one
// warning per provider, as the panel's test mode words do not hold then.
// Tests set them on purpose and stay quiet
if (env.NODE_ENV !== "test") {
  warnFakeProviders(env)
}

module.exports = defineConfig({
  // adr/0022 §3: the shop works in our panel; Medusa's own admin is off
  // unless the platform team opens it (MEDUSA_ADMIN=on)
  admin: { disable: env.MEDUSA_ADMIN !== "on" },
  // Core, modules and scripts log through the platform logger: JSON,
  // redacted, with the request ID (docs/10)
  logger: new MedusaPinoLogger(baseLogger, env.LOG_LEVEL ?? DEFAULT_LOG_LEVEL),
  projectConfig: {
    databaseUrl: env.DATABASE_URL,
    // Integration tests: Medusa's test runner replaces the driver options, so
    // the test database settings live in integration-tests/database.js
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
      // adr/0037 §1: a customer's e-mail login works once the address is
      // confirmed; Medusa refuses it before (`verification_required`)
      authVerificationsPerActor: {
        customer: [{ entity_type: "email", auth_provider: "emailpass" }],
      },
      // adr/0037 §3: staff log in with e-mail only; customers also with the
      // social providers this shop has set up
      authMethodsPerActor: { user: ["emailpass"], customer: auth.ids },
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
    // F5 (adr/0026 §5): incoming provider notifications, each handled once
    { resolve: "./src/modules/webhook-events" },
    // F5 (adr/0026 §6): payments that became no order, given back
    { resolve: "./src/modules/payment-recovery" },
    // F5 V9: hosted forms given out, for the iyzico reconcile job
    { resolve: "./src/modules/payment-forms" },
    // F6.7 (adr/0030): cardholders' disputes of order payments
    { resolve: "./src/modules/chargebacks" },
    // F7.5 (adr/0031): carriers' parcels and their statuses
    { resolve: "./src/modules/shipment-tracking" },
    // F7.9 (adr/0032): shoppers' return requests
    { resolve: "./src/modules/return-requests" },
    // F5 V5: refunds line by line, each made once
    { resolve: "./src/modules/order-refunds" },
    // F12.8: staff notes on orders
    { resolve: "./src/modules/order-notes" },
    // F13 (adr/0041): legal texts in versions, and the consents given to them
    {
      resolve: "./src/modules/legal",
      options: { encryptionKey: env.PII_ENCRYPTION_KEY, hashKey: env.PII_HASH_KEY },
    },
    // F10.2 (adr/0037 §3): configuring the module drops Medusa's default, so
    // e-mail is named again; Google and Apple only once their clients are set
    {
      resolve: "@medusajs/medusa/auth",
      dependencies: [Modules.CACHE, ContainerRegistrationKeys.LOGGER],
      options: {
        providers: auth.providers,
        // F12.6 (adr/0040): staff TOTP, sealed with its own key
        ...(env.AUTH_MFA_ENCRYPTION_KEY
          ? { mfa: { encryption_key: env.AUTH_MFA_ENCRYPTION_KEY } }
          : {}),
      },
    },
    // F5 (adr/0026): the hosted-form providers; the system provider stays registered
    {
      resolve: "@medusajs/medusa/payment",
      options: {
        providers: [
          { resolve: "./src/modules/payment-paytr", id: "paytr" },
          { resolve: "./src/modules/payment-iyzico", id: "iyzico" },
          { resolve: "./src/modules/payment-bank-transfer", id: "bank-transfer" },
          { resolve: "./src/modules/payment-cod", id: "cod" },
        ],
      },
    },
    // F9 (adr/0036): one provider per channel. Configuring the module drops
    // Medusa's default, so the panel bell's local `feed` provider is named again
    {
      resolve: "@medusajs/medusa/notification",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/notification-local",
            id: "local",
            options: { name: "Local Notification Provider", channels: ["feed"] },
          },
          {
            resolve: "./src/modules/notification-email",
            id: "email",
            options: { channels: ["email"] },
          },
          {
            resolve: "./src/modules/notification-sms",
            id: "sms",
            options: { channels: ["sms"] },
          },
        ],
      },
    },
    // F7 (adr/0031): Geliver beside Medusa's manual provider, which the seed's options use
    {
      resolve: "@medusajs/medusa/fulfillment",
      options: {
        providers: [
          { resolve: "@medusajs/medusa/fulfillment-manual", id: "manual" },
          { resolve: "./src/modules/fulfillment-geliver", id: "geliver" },
          { resolve: "./src/modules/fulfillment-aras", id: "aras" },
          { resolve: "./src/modules/fulfillment-yurtici", id: "yurtici" },
        ],
      },
    },
    {
      resolve: "./src/modules/billing-profile",
      options: { encryptionKey: env.PII_ENCRYPTION_KEY, hashKey: env.PII_HASH_KEY },
    },
    // F11.2 (adr/0039 §2): where carts came from, for the sales report
    { resolve: "./src/modules/traffic-sources" },
    // F11.3 (adr/0039 §3): PayTR's and iyzico's statements checked against the shop's payments
    { resolve: "./src/modules/statement-checks" },
    // F11.5 (adr/0039 §5): records sent to the shop's accounting program, until they go through
    { resolve: "./src/modules/accounting" },
    // F8 (adr/0034): orders' invoices, issued by the shop's program, until they are
    { resolve: "./src/modules/einvoice", options: { encryptionKey: env.PII_ENCRYPTION_KEY } },
    // F14 (adr/0042): a shop's data moved from its old platform, each record once
    { resolve: "./src/modules/migration" },
    // F15.6 (adr/0044): the shop's block list and the orders waiting for a person
    { resolve: "./src/modules/fraud-guard" },
    // F11.6 (adr/0039 §6): what each secret API key may reach; a key without a scope reaches nothing
    { resolve: "./src/modules/api-key-scopes" },
    // F12.6 (adr/0040): each staff member's role, read on every admin request
    {
      resolve: "./src/modules/staff-roles",
      options: { redisUrl: env.REDIS_URL, versionKey: `qt:staff-roles:${namespace}:version` },
    },
    // F11.8 (adr/0039 §8): storefront search terms by day, counts only, 180 days
    { resolve: "./src/modules/search-terms" },
    // adr/0056: site search and listings in PostgreSQL full text, synonyms shared by processes
    {
      resolve: "./src/modules/search-index",
      options: {
        redisUrl: env.REDIS_URL,
        versionKey: `qt:search-synonyms:${namespace}:version`,
      },
    },
    // F11.7 (adr/0039 §7): events sent to the shop's own systems, signed, tried until answered
    {
      resolve: "./src/modules/tenant-webhooks",
      options: { encryptionKey: env.PII_ENCRYPTION_KEY },
    },
    // F10.13 (adr/0005): drafts a provider wrote, shown only once staff approve them
    { resolve: "./src/modules/content-drafts" },
    // F10.11 (docs/13 §10): what Search Console and CrUX say of the shop
    { resolve: "./src/modules/seo-insights" },
    // F10.9 (adr/0038 §4): measurement consent per cart and order, and the events sent
    {
      resolve: "./src/modules/conversions",
      options: { encryptionKey: env.PII_ENCRYPTION_KEY },
    },
    // F10 M13 (adr/0038 §5): the Google connection under way and the Merchant Center offers
    {
      resolve: "./src/modules/google-merchant",
      options: { encryptionKey: env.PII_ENCRYPTION_KEY },
    },
    // adr/0058: the shop's Google reviews from its Business Profile, for the storefront
    { resolve: "./src/modules/google-reviews" },
    // F10.8 (adr/0038 §3): product feeds, their token hashed and encrypted, files private
    {
      resolve: "./src/modules/marketing-feeds",
      options: { hashKey: env.PII_HASH_KEY, encryptionKey: env.PII_ENCRYPTION_KEY },
    },
    // F10.7 (adr/0038 §1): one reminder per cart left behind, its link opening the cart once
    { resolve: "./src/modules/cart-reminders" },
    // adr/0050: bulk e-mail and SMS, recipients by keyed hash only
    { resolve: "./src/modules/campaigns" },
    // F10.10 (adr/0037 §4): product questions and answers, moderated
    { resolve: "./src/modules/product-qa" },
    // F10.6 (adr/0037 §4): purchasers' reviews, moderated, and their ratings
    { resolve: "./src/modules/product-reviews" },
    // F10.5 (adr/0037 §4): stock alerts, addresses encrypted and hashed
    {
      resolve: "./src/modules/back-in-stock",
      options: { hashKey: env.PII_HASH_KEY, encryptionKey: env.PII_ENCRYPTION_KEY },
    },
    // F18 D10 (adr/0047): the storefront's contact form, what was written sealed
    {
      resolve: "./src/modules/contact-messages",
      options: { hashKey: env.PII_HASH_KEY, encryptionKey: env.PII_ENCRYPTION_KEY },
    },
    // adr/0051: payment links staff make, the customer's contact sealed, the token hashed
    {
      resolve: "./src/modules/payment-links",
      options: { hashKey: env.PII_HASH_KEY, encryptionKey: env.PII_ENCRYPTION_KEY },
    },
    // F18 (adr/0049): the storefront's design from the theme editor: draft, live, revisions
    { resolve: "./src/modules/storefront-layout" },
    // F18 (adr/0049): the storefront's menus, their links pointing at records
    { resolve: "./src/modules/storefront-menus" },
    // F10.4 (adr/0037 §4): customers' saved products
    { resolve: "./src/modules/wishlist" },
    // F10.3 (adr/0037 §6): customer segments by rules, members in Medusa groups
    { resolve: "./src/modules/customer-segments" },
    // F9 (adr/0036): commercial consent and the suppression list, addresses hashed
    {
      resolve: "./src/modules/messaging",
      options: { hashKey: env.PII_HASH_KEY, encryptionKey: env.PII_ENCRYPTION_KEY },
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
