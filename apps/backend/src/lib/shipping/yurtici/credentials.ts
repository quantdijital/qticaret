/** A web service login Yurtiçi gives with the contract. */
export interface YurticiLogin {
  username: string
  password: string
}

/** The shop's Yurtiçi Kargo contract as the client takes it (adr/0035). */
export interface YurticiCredentials {
  /** The account parcels the shop pays for go out on. */
  main: YurticiLogin
  /** Yurtiçi's separate account for parcels paid at the door; null when the shop has none. */
  cod: YurticiLogin | null
  testMode: boolean
}

/**
 * The account as the panel stored it (adr/0027): the logins sealed, the
 * mode in the clear. Null when the main login is missing; the door
 * account counts only with both its parts.
 */
export function yurticiCredentialsOf(
  account: { settings: Record<string, unknown>; secrets: Record<string, string> } | null
): YurticiCredentials | null {
  const username = account?.secrets["username"]
  const password = account?.secrets["password"]
  if (!username || !password) {
    return null
  }
  const codUsername = account.secrets["cod_username"]
  const codPassword = account.secrets["cod_password"]
  return {
    main: { username, password },
    cod: codUsername && codPassword ? { username: codUsername, password: codPassword } : null,
    testMode: account.settings["test_mode"] === true,
  }
}
