const RULE = /^auth\.password_(too_short|too_long|common|contains_email|breached)$/

/**
 * A failure that is the server's password rule (adr/0043), as this panel's
 * text key; null for any other. The key is in `code` where the server
 * wrote this panel's sentence into `message`, else in `message` itself.
 */
export function passwordRuleText(error: unknown): string | null {
  const failure = error as { code?: unknown; key?: unknown; message?: unknown } | null
  for (const value of [failure?.code, failure?.key, failure?.message]) {
    const rule = typeof value === "string" ? RULE.exec(value)?.[1] : undefined
    if (rule) {
      return `passwordRule.${rule}`
    }
  }
  return null
}
