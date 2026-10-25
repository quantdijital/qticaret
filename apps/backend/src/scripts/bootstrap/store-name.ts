import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateStoresWorkflow } from "@medusajs/medusa/core-flows"
import { logger } from "../../lib/logging"
import { isCleanText } from "../../lib/security"

/** The name Medusa gives a new store (store module); a tenant's shop is named at setup. */
export const DEFAULT_STORE_NAME = "Medusa Store"

const MAX_STORE_NAME_LENGTH = 120
const FLAG = "--store-name"
// Invisible and direction-changing characters (zero-width, bidi overrides):
// a shop name shown in mails, invoices and structured data has no use for them
const FORMAT_CHARACTER = /\p{Cf}/u

/**
 * The shop name provisioning passes: `--store-name="Bıçak Dünyası"` or
 * `--store-name "Bıçak Dünyası"`. Undefined when not given; a given name
 * must be 1–120 characters without control characters.
 */
export function storeNameArg(args: readonly string[]): string | undefined {
  const index = args.findIndex((arg) => arg === FLAG || arg.startsWith(`${FLAG}=`))
  if (index === -1) {
    return undefined
  }
  const arg = args[index] ?? ""
  const raw = arg === FLAG ? (args[index + 1] ?? "") : arg.slice(FLAG.length + 1)
  const name = raw.trim()
  const valid =
    name !== "" &&
    name.length <= MAX_STORE_NAME_LENGTH &&
    // `--store-name --other-flag`: the next flag is not a name
    !name.startsWith("-") &&
    isCleanText(name) &&
    !FORMAT_CHARACTER.test(name)
  if (!valid) {
    throw new Error(`bootstrap: ${FLAG} must be 1–${String(MAX_STORE_NAME_LENGTH)} characters`)
  }
  return name
}

async function currentStore(container: MedusaContainer): Promise<{ id: string; name: string }> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "store", fields: ["id", "name"] })
  const store = data[0] as { id: string; name: string | null } | undefined
  if (!store) {
    throw new Error("bootstrap: no store found; start the server once so Medusa creates it")
  }
  return { id: store.id, name: store.name ?? "" }
}

/**
 * Names the shop at setup (docs/17): a store still called "Medusa Store"
 * refuses to be set up without `--store-name`. A rerun without the flag
 * keeps the name the shop chose since.
 */
export async function ensureStoreName(
  container: MedusaContainer,
  storeName: string | undefined
): Promise<void> {
  const store = await currentStore(container)
  if (storeName === undefined) {
    if (store.name === DEFAULT_STORE_NAME) {
      throw new Error(`bootstrap: the store has no name yet; pass ${FLAG}="..."`)
    }
    return
  }
  if (store.name === storeName) {
    return
  }
  await updateStoresWorkflow(container).run({
    input: { selector: { id: store.id }, update: { name: storeName } },
  })
  logger.info({ event: "bootstrap.store_named", storeId: store.id }, "store named")
}
