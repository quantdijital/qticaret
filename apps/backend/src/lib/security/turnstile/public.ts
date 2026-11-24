import { parseEnv } from "../../env"
import { turnstileKeys } from "./env"

export interface TurnstilePublic {
  /** The widget's site key (public by design); null only where the shop could not have started. */
  site_key: string | null
}

/** What a client needs to draw Turnstile's widget (adr/0044 Ek 2026-11-24): the site key, never the secret. */
export function turnstilePublic(env = parseEnv()): TurnstilePublic {
  return { site_key: turnstileKeys(env)?.siteKey ?? null }
}
