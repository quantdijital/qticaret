/** The shop's Geliver account as the client takes it (adr/0027, adr/0031). */
export interface GeliverCredentials {
  token: string
  /** Shipments are created as Geliver's test shipments: nothing is bought or collected. */
  testMode: boolean
}

export type GeliverCredentialCheck = "valid" | "secret_invalid"
