import { isArasServiceUrl } from "./client"

/** The shop's Aras Kargo contract as the client takes it (adr/0035). */
export interface ArasCredentials {
  username: string
  password: string
  /** Aras's code for the shop's account, asked by the tracking call. */
  customerCode: string | null
  testMode: boolean
  /** The service's address when Aras gave one; else the test or live default. */
  serviceUrl: string | null
}

/**
 * The account as the panel stored it (adr/0027): the user name and the
 * password sealed, the customer code, the mode and the address in the
 * clear. Null when the user name or the password is missing, or the
 * stored address is not one of Aras's (checked again at every read).
 */
export function arasCredentialsOf(
  account: { settings: Record<string, unknown>; secrets: Record<string, string> } | null
): ArasCredentials | null {
  const username = account?.secrets["username"]
  const password = account?.secrets["password"]
  if (!username || !password) {
    return null
  }
  const text = (key: string) => {
    const value = account.settings[key]
    return typeof value === "string" && value.trim() !== "" ? value.trim() : null
  }
  const serviceUrl = text("service_url")
  if (serviceUrl !== null && !isArasServiceUrl(serviceUrl)) {
    return null
  }
  return {
    username,
    password,
    customerCode: text("customer_code"),
    testMode: account.settings["test_mode"] === true,
    serviceUrl,
  }
}
