import type { ExecArgs, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { deleteShippingOptionsWorkflow } from "@medusajs/medusa/core-flows"
import { logger } from "../lib/logging"
import { INTEGRATION_CREDENTIALS_MODULE } from "../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../modules/integration-credentials/service"

/**
 * The aggregator carrier the app no longer registers (adr/0031, 2026-11-26
 * addendum): its fulfillment provider id and its credential row's name.
 */
const RETIRED_PROVIDER_ID = "geliver_geliver"
const RETIRED_ACCOUNT = "geliver"

export interface RetiredCarrierPorts {
  /** Shipping options (not deleted yet) on the retired provider. */
  listOptionIds: () => Promise<string[]>
  deleteOptions: (ids: string[]) => Promise<void>
  /** Warehouses the retired provider is linked to. */
  listLinkedLocations: () => Promise<string[]>
  unlinkLocations: (ids: string[]) => Promise<void>
  /** The stored account's row ids (sealed secrets inside). */
  listAccountIds: () => Promise<string[]>
  deleteAccounts: (ids: string[]) => Promise<void>
}

export interface RetiredCarrierTally {
  options: number
  locations: number
  accounts: number
}

/**
 * What the removed carrier left behind, taken away (idempotent: a second
 * run finds nothing):
 * - its shipping options, soft-deleted as Medusa deletes any: shoppers are
 *   no longer offered an option nothing can price or ship; old orders keep
 *   their methods and fulfillments, shown read only;
 * - its links to warehouses;
 * - the shop's stored account for it: a secret no code reads any more is
 *   not kept (docs/04). Only ids and counts are logged.
 */
export async function removeRetiredCarrier(
  ports: RetiredCarrierPorts
): Promise<RetiredCarrierTally> {
  const options = await ports.listOptionIds()
  if (options.length > 0) {
    await ports.deleteOptions(options)
  }
  const locations = await ports.listLinkedLocations()
  if (locations.length > 0) {
    await ports.unlinkLocations(locations)
  }
  const accounts = await ports.listAccountIds()
  if (accounts.length > 0) {
    await ports.deleteAccounts(accounts)
  }
  return { options: options.length, locations: locations.length, accounts: accounts.length }
}

const idsOf = (rows: unknown[]): string[] =>
  rows.flatMap((row) => {
    const id = (row as { id?: unknown } | null)?.id
    return typeof id === "string" ? [id] : []
  })

export function retiredCarrierPorts(container: MedusaContainer): RetiredCarrierPorts {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const accounts = container.resolve<IntegrationCredentialsModuleService>(
    INTEGRATION_CREDENTIALS_MODULE
  )
  return {
    listOptionIds: async () => {
      const { data } = await query.graph({
        entity: "shipping_option",
        fields: ["id"],
        filters: { provider_id: RETIRED_PROVIDER_ID },
      })
      return idsOf(data)
    },
    deleteOptions: async (ids) => {
      await deleteShippingOptionsWorkflow(container).run({ input: { ids } })
    },
    listLinkedLocations: async () => {
      const { data } = await query.graph({
        entity: "stock_location",
        fields: ["id", "fulfillment_providers.id"],
      })
      return (
        data as { id: string; fulfillment_providers?: ({ id?: string } | null)[] | null }[]
      ).flatMap((row) =>
        (row.fulfillment_providers ?? []).some((provider) => provider?.id === RETIRED_PROVIDER_ID)
          ? [row.id]
          : []
      )
    },
    unlinkLocations: async (ids) => {
      await container.resolve(ContainerRegistrationKeys.LINK).dismiss(
        ids.map((id) => ({
          [Modules.STOCK_LOCATION]: { stock_location_id: id },
          [Modules.FULFILLMENT]: { fulfillment_provider_id: RETIRED_PROVIDER_ID },
        }))
      )
    },
    listAccountIds: async () =>
      idsOf(
        await accounts.listIntegrationCredentials({ provider: RETIRED_ACCOUNT }, { select: ["id"] })
      ),
    deleteAccounts: async (ids) => {
      await accounts.deleteIntegrationCredentials(ids)
    },
  }
}

/** Runs once per shop, on the `db:migrate` that removes the carrier (adr/0031 Ek 2026-11-26). */
export default async function geliverRemoved({ container }: ExecArgs) {
  const tally = await removeRetiredCarrier(retiredCarrierPorts(container))
  logger.info({ event: "shipping.retired_carrier_removed", ...tally })
}
