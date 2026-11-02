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
import {
  E2E_STAFF_EMAIL,
  demoShippingOptionsToRemove,
  isDemoWarehouseAddress,
  isLeftoverImportCheck,
} from "./select"
import type { ImportJobRow, LocationAddressRow } from "./select"

/**
 * The seed's two flat-rate options, once the shop ships some other way;
 * else they stay (checkout would offer no shipping) and the run says so.
 */
export async function removeDemoShippingOptions(
  container: MedusaContainer
): Promise<{ removed: number; keptForCheckout: number }> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "name", "provider_id", "type.code", "rules.attribute", "rules.value"],
  })
  const { remove, keptForCheckout } = demoShippingOptionsToRemove(data)
  if (remove.length > 0) {
    await deleteShippingOptionsWorkflow(container).run({ input: { ids: remove } })
  }
  return { removed: remove.length, keptForCheckout: keptForCheckout.length }
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

/** The warehouse keeps its name, stock and links; only the seed's made-up address and phone go. */
export async function clearDemoWarehouseAddress(container: MedusaContainer): Promise<number> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name", "address.address_1", "address.phone", "address.postal_code"],
  })
  const rows = data as unknown as {
    id: string
    name: string
    address?: LocationAddressRow | null
  }[]
  const demo = rows.filter((location) => isDemoWarehouseAddress(location.address))
  for (const location of demo) {
    await updateWarehouseWorkflow(container).run({
      input: { id: location.id, name: location.name, address: CLEARED_ADDRESS },
    })
  }
  return demo.length
}

/** Staff an e2e run made and did not remove (a run cut short); their role, user and login. */
export async function removeE2eStaff(
  container: MedusaContainer
): Promise<{ removed: string[]; failed: number }> {
  const users = await container
    .resolve(Modules.USER)
    .listUsers({}, { select: ["id", "email"], take: null })
  const removed: string[] = []
  let failed = 0
  for (const user of users.filter((each) => E2E_STAFF_EMAIL.test(each.email))) {
    try {
      await removeStaffMemberWorkflow(container).run({ input: { user_id: user.id } })
      removed.push(user.id)
    } catch (error) {
      // The address is the e2e setup's, made up: no one's personal data in the log
      logger.warn({ event: "demo.e2e_staff_kept", err: errorSummary(error) })
      failed += 1
    }
  }
  return { removed, failed }
}

/** Sheet checks e2e runs left in Settings > Jobs: finished, asked for by e2e staff now gone. */
export async function removeLeftoverImportChecks(
  container: MedusaContainer,
  removedUserIds: ReadonlySet<string>
): Promise<number> {
  const jobs = await container
    .resolve<AsyncJobModuleService>(ASYNC_JOB_MODULE)
    .listAsyncJobs(
      { type: "catalog.import" },
      { select: ["id", "type", "status", "input", "requested_by"], take: null }
    )
  const users = await container.resolve(Modules.USER).listUsers({}, { select: ["id"], take: null })
  const live = new Set(users.map((user) => user.id))
  const ids = (jobs as unknown as ImportJobRow[])
    .filter((job) => isLeftoverImportCheck(job, live, removedUserIds))
    .map((job) => job.id)
  if (ids.length > 0) {
    await removeLeftoverJobsWorkflow(container).run({ input: { ids } })
  }
  return ids.length
}
