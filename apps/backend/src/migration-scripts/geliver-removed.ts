import type { ExecArgs, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { deleteShippingOptionsWorkflow } from "@medusajs/medusa/core-flows"
import { logger } from "../lib/logging"
import { INTEGRATION_CREDENTIALS_MODULE } from "../modules/integration-credentials"
import type { CredentialProviderName } from "../modules/integration-credentials/providers"
import type IntegrationCredentialsModuleService from "../modules/integration-credentials/service"
import { RETURN_REQUESTS_MODULE } from "../modules/return-requests"
import type ReturnRequestsModuleService from "../modules/return-requests/service"

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
  /** Whether the shop has a stored account for it (sealed secrets inside). */
  hasAccount: () => Promise<boolean>
  /** Deletes it, the accounts' cache with it. */
  deleteAccount: () => Promise<void>
  /** Approved returns with the carrier's return code, not yet seen handed over. */
  countOpenCarrierReturns: () => Promise<number>
}

export interface RetiredCarrierTally {
  options: number
  locations: number
  accounts: number
  /** Return codes staff may still withdraw in the carrier's own panel. */
  open_returns: number
}

/**
 * What the removed carrier left behind, taken away (idempotent: a second
 * run finds nothing):
 * - its shipping options, soft-deleted as Medusa deletes any: shoppers are
 *   no longer offered an option nothing can price or ship; old orders keep
 *   their methods and fulfillments, shown read only;
 * - its links to warehouses;
 * - the shop's stored account for it: a secret no code reads any more is
 *   not kept (docs/04).
 * Approved returns still holding its return code are counted, not
 * changed: staff withdraw them in the carrier's own panel (security
 * review 2026-11-26). Only counts are logged.
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
  const open_returns = await ports.countOpenCarrierReturns()
  const account = await ports.hasAccount()
  if (account) {
    await ports.deleteAccount()
  }
  return {
    options: options.length,
    locations: locations.length,
    accounts: account ? 1 : 0,
    open_returns,
  }
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
    hasAccount: async () =>
      (
        await accounts.listIntegrationCredentials(
          { provider: RETIRED_ACCOUNT },
          { select: ["id"], take: 1 }
        )
      ).length > 0,
    // The service's own removal: the row and the accounts' cache (one row per provider)
    deleteAccount: async () => {
      await accounts.remove(RETIRED_ACCOUNT as CredentialProviderName)
    },
    countOpenCarrierReturns: async () =>
      (
        await container
          .resolve<ReturnRequestsModuleService>(RETURN_REQUESTS_MODULE)
          .listReturnRequests(
            { status: "approved", return_shipment_id: { $ne: null }, handed_over_at: null },
            { select: ["id"] }
          )
      ).length,
  }
}

/** Runs once per shop, on the `db:migrate` that removes the carrier (adr/0031 Ek 2026-11-26). */
export default async function geliverRemoved({ container }: ExecArgs) {
  const tally = await removeRetiredCarrier(retiredCarrierPorts(container))
  logger.info({ event: "shipping.retired_carrier_removed", ...tally })
  if (tally.open_returns > 0) {
    logger.warn(
      { event: "shipping.retired_carrier_open_returns", count: tally.open_returns },
      "approved returns still hold the removed carrier's return code: withdraw them in its panel"
    )
  }
}
