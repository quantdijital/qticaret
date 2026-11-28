/** The shop's PTT Kargo contract as the client takes it (docs/entegrasyonlar/ptt.md). */
export interface PttCredentials {
  /** PTT's customer number (`musteriId`, 9 or 10 digits), from the Başmüdürlük. */
  customerId: string
  /** The web service password given with it. */
  password: string
  /** PTT's test services (`…Test/services/Sorgu`) instead of the live ones. */
  testMode: boolean
}

/**
 * The account as the panel stored it (adr/0027): the customer number a
 * setting (shown, checked for its form), the password sealed. Null when
 * either is missing.
 */
export function pttCredentialsOf(
  account: { settings: Record<string, unknown>; secrets: Record<string, string> } | null
): PttCredentials | null {
  const customerId = account?.settings["customer_id"]
  const password = account?.secrets["password"]
  if (typeof customerId !== "string" || !/^\d{9,10}$/.test(customerId) || !password) {
    return null
  }
  return { customerId, password, testMode: account.settings["test_mode"] === true }
}

/** The account's values: masked wherever PTT quotes one back. */
export const pttSecrets = (credentials: PttCredentials): string[] => [
  credentials.customerId,
  credentials.password,
]
