import type { Env } from "../env"

interface ProviderEntry {
  resolve: string
  id: string
  options?: Record<string, unknown>
}

/**
 * The social providers whose sign-in proves the address it carries
 * (`provenCustomer`). A provider joins this list only if it refuses an
 * address its owner has not verified: Google (Medusa's provider refuses
 * `email_verified: false`, 2.21.2) and Apple (ours checks it,
 * `modules/auth-apple`). Every social provider `customerAuthProviders`
 * offers must be on it, or decided otherwise (unit-tested).
 */
export const ADDRESS_VOUCHING_PROVIDERS: readonly string[] = ["google", "apple"]

/**
 * The customer's ways in (adr/0037 §3): e-mail always; Google and Apple
 * once the shop's OAuth client is set at provisioning, every value of it.
 */
export function customerAuthProviders(env: Env): { providers: ProviderEntry[]; ids: string[] } {
  const providers: ProviderEntry[] = [
    { resolve: "@medusajs/medusa/auth-emailpass", id: "emailpass" },
  ]
  if (env.GOOGLE_AUTH_CLIENT_ID && env.GOOGLE_AUTH_CLIENT_SECRET && env.GOOGLE_AUTH_CALLBACK_URL) {
    providers.push({
      resolve: "@medusajs/medusa/auth-google",
      id: "google",
      options: {
        clientId: env.GOOGLE_AUTH_CLIENT_ID,
        clientSecret: env.GOOGLE_AUTH_CLIENT_SECRET,
        callbackUrl: env.GOOGLE_AUTH_CALLBACK_URL,
      },
    })
  }
  if (
    env.APPLE_AUTH_CLIENT_ID &&
    env.APPLE_AUTH_TEAM_ID &&
    env.APPLE_AUTH_KEY_ID &&
    env.APPLE_AUTH_PRIVATE_KEY &&
    env.APPLE_AUTH_CALLBACK_URL
  ) {
    providers.push({
      resolve: "./src/modules/auth-apple",
      id: "apple",
      options: {
        clientId: env.APPLE_AUTH_CLIENT_ID,
        teamId: env.APPLE_AUTH_TEAM_ID,
        keyId: env.APPLE_AUTH_KEY_ID,
        privateKey: env.APPLE_AUTH_PRIVATE_KEY,
        callbackUrl: env.APPLE_AUTH_CALLBACK_URL,
        ...(env.APPLE_AUTH_BASE_URL ? { baseUrl: env.APPLE_AUTH_BASE_URL } : {}),
      },
    })
  }
  return { providers, ids: providers.map(({ id }) => id) }
}
