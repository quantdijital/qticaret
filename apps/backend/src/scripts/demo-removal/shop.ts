import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { deleteShippingOptionsWorkflow } from "@medusajs/medusa/core-flows"
import { errorSummary, logger } from "../../lib/logging"
import { ASYNC_JOB_MODULE } from "../../modules/async-job"
import type AsyncJobModuleService from "../../modules/async-job/service"
import { removeLeftoverJobsWorkflow } from "../../workflows/demo/remove-demo-records"
import { removeStaffMemberWorkflow } from "../../workflows/staff/remove-member"
import { updateWarehouseWorkflow } from "../../workflows/stock/warehouses"
import { TR_COUNTRY_CODE } from "../bootstrap/constants"
import type { DemoRemovalPlan, PlannedRecord } from "./plan"
import {
  E2E_STAFF_EMAIL,
  demoShippingOptionsToRemove,
  isDemoShippingOption,
  isDemoWarehouseAddress,
  isLeftoverImportCheck,
  looksLikeDemoShippingOption,
} from "./select"
import type { ImportJobRow, LocationAddressRow, ShippingOptionRow } from "./select"

/**
 * The seed's two flat-rate options (marked, or made before the mark with no
 * metadata), once the shop ships some other way; else they stay (checkout
 * would offer no shipping) and the run says so.
 */
export async function findDemoShippingOptions(
  container: MedusaContainer
): Promise<{ found: PlannedRecord[]; keptForCheckout: number; skipped: string[] }> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "shipping_option",
    fields: [
      "id",
      "name",
      "provider_id",
      "metadata",
      "type.code",
      "rules.attribute",
      "rules.value",
    ],
  })
  const rows = data as unknown as ShippingOptionRow[]
  const { remove, keptForCheckout } = demoShippingOptionsToRemove(rows)
  const names = new Map(rows.map((row) => [row.id, row.name]))
  return {
    found: remove.map((id) => ({ id, label: names.get(id) ?? "" })),
    keptForCheckout: keptForCheckout.length,
    skipped: rows
      .filter((row) => looksLikeDemoShippingOption(row) && !isDemoShippingOption(row))
      .map((row) => row.name),
  }
}

export async function removeDemoShippingOptions(
  container: MedusaContainer,
  options: readonly PlannedRecord[]
): Promise<number> {
  if (options.length > 0) {
    await deleteShippingOptionsWorkflow(container).run({
      input: { ids: options.map((option) => option.id) },
    })
  }
  return options.length
}

// Medusa's address keeps a first line and a country: both left blank-ish, the rest cleared
const CLEARED_ADDRESS = {
  address_1: "",
  address_2: null,
  city: null,
  province: null,
  postal_code: null,
  phone: null,
  country_code: TR_COUNTRY_CODE,
}

/** Warehouses still at the seed's made-up address and phone. */
export async function findDemoWarehouses(container: MedusaContainer): Promise<PlannedRecord[]> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "stock_location",
    fields: ["id", "name", "address.address_1", "address.phone", "address.postal_code"],
  })
  const rows = data as unknown as {
    id: string
    name: string
    address?: LocationAddressRow | null
  }[]
  return rows
    .filter((location) => isDemoWarehouseAddress(location.address))
    .map((location) => ({ id: location.id, label: location.name }))
}

/** The warehouse keeps its name, stock and links; only the seed's made-up address and phone go. */
export async function clearDemoWarehouseAddresses(
  container: MedusaContainer,
  warehouses: readonly PlannedRecord[]
): Promise<number> {
  for (const location of warehouses) {
    await updateWarehouseWorkflow(container).run({
      input: { id: location.id, name: location.label, address: CLEARED_ADDRESS },
    })
  }
  return warehouses.length
}

/** Staff an e2e run made and did not remove (a run cut short), by user id. */
export async function findE2eStaff(container: MedusaContainer): Promise<PlannedRecord[]> {
  const users = await container
    .resolve(Modules.USER)
    .listUsers({}, { select: ["id", "email"], take: null })
  return users
    .filter((user) => E2E_STAFF_EMAIL.test(user.email))
    .map((user) => ({ id: user.id, label: "e2e" }))
}

/** The planned e2e staff: their role, user and login. */
export async function removeE2eStaff(
  container: MedusaContainer,
  staff: readonly PlannedRecord[]
): Promise<{ removed: string[]; failed: string[] }> {
  const removed: string[] = []
  const failed: string[] = []
  for (const user of staff) {
    try {
      await removeStaffMemberWorkflow(container).run({ input: { user_id: user.id } })
      removed.push(user.id)
    } catch (error) {
      // The address is the e2e setup's, made up: no one's personal data in the log
      logger.warn({ event: "demo.e2e_staff_kept", err: errorSummary(error) })
      failed.push(user.id)
    }
  }
  return { removed, failed }
}

/** Sheet checks e2e runs left in Settings > Jobs: finished, asked for by e2e staff gone or going. */
export async function findLeftoverImportChecks(
  container: MedusaContainer,
  going: ReadonlySet<string>
): Promise<DemoRemovalPlan["importChecks"]> {
  const jobs = await container
    .resolve<AsyncJobModuleService>(ASYNC_JOB_MODULE)
    .listAsyncJobs(
      { type: "catalog.import" },
      { select: ["id", "type", "status", "input", "requested_by"], take: null }
    )
  const users = await container.resolve(Modules.USER).listUsers({}, { select: ["id"], take: null })
  const live = new Set(users.map((user) => user.id))
  return (jobs as unknown as ImportJobRow[])
    .filter((job) => isLeftoverImportCheck(job, live, going))
    .map((job) => ({ id: job.id, label: job.type, requested_by: job.requested_by ?? "" }))
}

/** The planned checks, but not those of e2e staff the run could not remove. */
export async function removeLeftoverImportChecks(
  container: MedusaContainer,
  checks: DemoRemovalPlan["importChecks"],
  staffKept: ReadonlySet<string>
): Promise<number> {
  const ids = checks.filter((job) => !staffKept.has(job.requested_by)).map((job) => job.id)
  if (ids.length > 0) {
    await removeLeftoverJobsWorkflow(container).run({ input: { ids } })
  }
  return ids.length
}
