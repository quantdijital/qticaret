import { isProviderError } from "../errors"
import { errorSummary, logger } from "../logging"
import { paytrApi, paytrCredentialsOf } from "../payments/paytr"

/**
 * Asks a provider whether the shop's account details work (adr/0027 §4).
 * A provider that cannot be reached is `unreachable`, not a verdict on the
 * details: the panel saves them and says they are not checked yet.
 */

export type AccountCheck = "valid" | "merchant_invalid" | "secret_invalid" | "unreachable"

export interface AccountDetails {
  settings: Record<string, unknown>
  secrets: Record<string, string>
}

type Checker = (account: AccountDetails) => Promise<AccountCheck>

const CHECKERS: Readonly<Record<string, Checker>> = {
  paytr: async (account) => {
    const credentials = paytrCredentialsOf(account)
    return credentials ? paytrApi().checkCredentials(credentials) : "merchant_invalid"
  },
}

export async function checkAccount(
  provider: string,
  account: AccountDetails
): Promise<AccountCheck> {
  const checker = CHECKERS[provider]
  if (!checker) {
    return "unreachable"
  }
  try {
    return await checker(account)
  } catch (error) {
    if (!isProviderError(error)) {
      throw error
    }
    logger.warn({ event: "integrations.account_check_failed", provider, err: errorSummary(error) })
    return "unreachable"
  }
}

/** Which field the panel points at when a check refuses the details. */
export const CHECK_FIELDS: Readonly<
  Record<string, Record<"merchant_invalid" | "secret_invalid", string>>
> = {
  paytr: { merchant_invalid: "settings.merchant_id", secret_invalid: "secrets.merchant_key" },
}
