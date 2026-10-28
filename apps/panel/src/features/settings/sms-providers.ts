/**
 * The SMS services a shop can send with, as Settings > SMS lists them
 * (adr/0036): the shop's own account, since its sender name is registered
 * to its company. Netgsm first; others join the same way. The id is the
 * provider's key in `integration-credentials` and in the page's address.
 */
export const SMS_PROVIDERS = [{ id: "netgsm" }] as const

export type SmsProviderId = (typeof SMS_PROVIDERS)[number]["id"]

export const isSmsProvider = (id: string): id is SmsProviderId =>
  SMS_PROVIDERS.some((provider) => provider.id === id)
