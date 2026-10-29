import { z } from "@medusajs/framework/zod"
import { ACCOUNTING_ADAPTERS } from "../../../lib/accounting/adapters"
import type { AccountingAdapterId } from "../../../lib/accounting/adapters"
import { defineSection } from "./define"

export interface AccountingSettings {
  /** The program sales, collections and refunds go to (F11.5); `none` until the shop picks one. */
  adapter: AccountingAdapterId
}

/** Where the shop's books are kept (adr/0039 §5): nothing is sent until a program is picked. */
export const accountingSection = defineSection<AccountingSettings>(
  "accounting",
  { adapter: z.enum(ACCOUNTING_ADAPTERS) },
  { adapter: "none" }
)
