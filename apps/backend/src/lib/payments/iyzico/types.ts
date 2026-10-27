/** The shop's iyzico account as the client takes it (adr/0027). */
export interface IyzicoCredentials {
  apiKey: string
  secretKey: string
  /** iyzico's sandbox: its own address and its own keys. */
  testMode: boolean
}

/** What a connection check says about the keys; an unreachable iyzico throws instead. */
export type IyzicoCredentialCheck = "valid" | "merchant_invalid" | "secret_invalid"
