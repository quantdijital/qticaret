import type { Env } from "../env"

interface ProviderEntry {
  resolve: string
  id: string
  options?: Record<string, unknown>
}

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
