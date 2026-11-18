import { z } from "@medusajs/framework/zod"
import type { CredentialProvider } from "./providers"

/**
 * The AI services a shop connects with its own key (adr/0071 §3), kept
 * apart from `providers.ts` so that file stays short. One key each and no
 * setting: the address is fixed in the AI registry (`lib/ai/registry`), so
 * there is no base address field to point a call elsewhere (§9 SSRF). A
 * service whose region or plan would be another account gets a `z.enum`
 * setting once its documentation is verified; none is today.
 */

// Printable ASCII without spaces, as a service's console copies it out; at most what the
// route takes for any secret (`api/admin/integrations/credentials/validators.ts`, 256)
const apiKey = z
  .string()
  .trim()
  .regex(/^[\x21-\x7E]{16,256}$/, "integration_credentials.secret_invalid")

export const AI_CREDENTIAL_PROVIDERS = {
  // DeepSeek platform > API keys
  deepseek: {
    settings: z.object({}).strict(),
    secrets: ["api_key"],
    secret: apiKey,
    identity: [],
    optional: [],
  },
  // MiniMax international platform > API keys
  minimax: {
    settings: z.object({}).strict(),
    secrets: ["api_key"],
    secret: apiKey,
    identity: [],
    optional: [],
  },
  // Google AI Studio > API keys
  gemini: {
    settings: z.object({}).strict(),
    secrets: ["api_key"],
    secret: apiKey,
    identity: [],
    optional: [],
  },
  // Image editing (Aşama 4); a sandbox key (`sandbox_…`) is a key like any other
  photoroom: {
    settings: z.object({}).strict(),
    secrets: ["api_key"],
    secret: apiKey,
    identity: [],
    optional: [],
  },
  // The fake AI service's account (`lib/ai` registry): development and tests only, see
  // `LOCAL_ONLY_PROVIDERS`. Its check never leaves the machine
  fake: {
    settings: z.object({}).strict(),
    secrets: ["api_key"],
    secret: apiKey,
    identity: [],
    optional: [],
  },
} as const satisfies Record<string, CredentialProvider>

export type AiCredentialProviderName = keyof typeof AI_CREDENTIAL_PROVIDERS

/** Providers that exist under NODE_ENV test and development only, like the fake AI service. */
export const LOCAL_ONLY_PROVIDERS: readonly string[] = ["fake"]

/** Whether this process may offer the local-only providers (an unset NODE_ENV is live). */
export const offersLocalProviders = (
  nodeEnv: string | undefined = process.env["NODE_ENV"]
): boolean => nodeEnv === "test" || nodeEnv === "development"

/** Whether connecting `provider` is the "own key" way of paying for AI (`ai.own_keys`). */
export const isAiCredentialProvider = (provider: string): provider is AiCredentialProviderName =>
  Object.hasOwn(AI_CREDENTIAL_PROVIDERS, provider)
