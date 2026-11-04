import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ASYNC_JOB_MODULE } from "../../../../modules/async-job"
import type AsyncJobModuleService from "../../../../modules/async-job/service"
import { TR_ADDRESS_MODULE } from "../../../../modules/tr-address"
import type TrAddressModuleService from "../../../../modules/tr-address/service"
import { TR_ADDRESS_SYNC_JOB } from "../../../../workflows/async-job/types/tr-address-sync"
import { serializeJob } from "../../async-jobs/serialize"

/**
 * `GET /admin/tr-address/status` (adr/0008 Ek 2026-11-04): how many places
 * the address forms offer, which data they are (source, TürkiyeAPI's
 * dataset version and date, when it was imported), and the newest sync
 * job, running or done, for the panel's card. Every role reads it.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const addresses = req.scope.resolve<TrAddressModuleService>(TR_ADDRESS_MODULE)
  const jobs = req.scope.resolve<AsyncJobModuleService>(ASYNC_JOB_MODULE)
  const counts = await addresses.countActive()
  const latest = await addresses.latestSync()
  const [job] = await jobs.listAsyncJobs(
    { type: TR_ADDRESS_SYNC_JOB },
    { order: { created_at: "DESC", id: "DESC" }, take: 1 }
  )
  res.json({
    ...counts,
    source: latest?.source ?? null,
    dataset_version: latest?.dataset_version ?? null,
    last_updated: latest?.dataset_last_updated ?? null,
    last_sync_at: latest?.created_at ?? null,
    job: job ? serializeJob(job) : null,
  })
}
