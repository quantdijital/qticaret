import type { MedusaContainer } from "@medusajs/framework/types"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { TURKIYEAPI_IDS, fakeTurkiyeApiDataset, startFakeTurkiyeApi } from "@qticaret/testing"
import type { FakeTurkiyeApi } from "@qticaret/testing"
import { serializeJob } from "../../src/api/admin/async-jobs/serialize"
import trAddressSyncJob from "../../src/jobs/tr-address-sync"
import { logger } from "../../src/lib/logging"
import { ASYNC_JOB_MODULE } from "../../src/modules/async-job"
import type AsyncJobModuleService from "../../src/modules/async-job/service"
import { AUDIT_LOG_MODULE } from "../../src/modules/audit-log"
import type AuditLogModuleService from "../../src/modules/audit-log/service"
import { validateTrAddress } from "../../src/modules/tr-address/validation"
import { enqueueAsyncJobWorkflow } from "../../src/workflows/async-job/enqueue-async-job"
import { TR_ADDRESS_SYNC_JOB } from "../../src/workflows/async-job/types/tr-address-sync"
import { createAdminUser } from "../helpers/admin"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture, trAddressService } from "../helpers/tr-address"

jest.setTimeout(180 * 1000)

interface Job {
  id: string
  type: string
  status: string
  progress: number | null
  result_summary: Record<string, unknown> | null
  error_code: string | null
  error_message: string | null
}

const finished = (job: Job | undefined) =>
  job !== undefined && job.status !== "queued" && job.status !== "running"

/**
 * adr/0008 Ek 2026-11-04: the address data from TürkiyeAPI (a fake one
 * here; never the real API), kept by the platform: the weekly check
 * queues the sync job, the CLI imports by hand. The shop's panel has no
 * surface for it (the owner's ruling, 2026-11-04): the job and its audit
 * entries are read here as the operator reads them, from the modules; the
 * admin API leaves both out (async-jobs.spec, audit-log.spec).
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakeTurkiyeApi
    let owner: { headers: Record<string, string> }
    let storefront: Storefront

    beforeAll(async () => {
      fake = await startFakeTurkiyeApi()
      process.env["TURKIYEAPI_BASE_URL"] = fake.url
    })
    afterAll(async () => {
      Reflect.deleteProperty(process.env, "TURKIYEAPI_BASE_URL")
      await fake.close()
    })
    beforeEach(async () => {
      fake.dataset = fakeTurkiyeApiDataset()
      Object.assign(fake, {
        failFiles: false,
        down: false,
        requests: [],
        lastUpdated: "2026-05-21",
      })
      owner = await createAdminUser(http, getContainer())
      storefront = await createStorefront(getContainer())
    })
    afterEach(async () => {
      jest.restoreAllMocks()
      // A sync a failed assertion left behind must not outlive the test's database
      await eventually(unfinishedJobs, (count) => count === 0, 300)
    })

    // What the operator reads (the module, the newest sync record): no admin route says it
    const data = async () => {
      const service = trAddressService(getContainer())
      const latest = await service.latestSync()
      return {
        ...(await service.countActive()),
        source: latest?.source ?? null,
        dataset_version: latest?.dataset_version ?? null,
        last_updated: latest?.dataset_last_updated ?? null,
      }
    }
    const jobs = () => getContainer().resolve<AsyncJobModuleService>(ASYNC_JOB_MODULE)
    const latestJobId = async () => {
      const [job] = await jobs().listAsyncJobs(
        { type: TR_ADDRESS_SYNC_JOB },
        { order: { created_at: "DESC", id: "DESC" }, take: 1 }
      )
      return job?.id ?? null
    }
    const unfinishedJobs = async () =>
      (await jobs().listAsyncJobs({ type: TR_ADDRESS_SYNC_JOB, status: ["queued", "running"] }))
        .length
    // The job as the operator reads it: the admin API answers 404 for the platform's jobs
    const job = async (id: string): Promise<Job> => serializeJob(await jobs().retrieveAsyncJob(id))
    const waitFor = (id: string) => eventually(() => job(id), finished, 150)
    // The job as the weekly check queues it, without its version check: a sync now
    const sync = async () => {
      const { result } = await enqueueAsyncJobWorkflow(getContainer()).run({
        input: { type: TR_ADDRESS_SYNC_JOB, input: { only_if_changed: false }, requested_by: null },
      })
      return waitFor(result.id)
    }
    const districtId = async (container: MedusaContainer, externalId: number) =>
      (
        await trAddressService(container).listTrDistricts({
          external_id: `turkiyeapi:district:${String(externalId)}`,
        })
      )[0]?.id ?? "-"
    const neighborhoodsOf = async (externalId: number) => {
      const response = await settle(
        http.get<{ neighborhoods: { name: string; postal_code: string }[] }>(
          `/store/tr-address/neighborhoods?district=${await districtId(getContainer(), externalId)}`,
          { headers: storefront.headers }
        )
      )
      expect(response.status).toBe(200)
      return response.data.neighborhoods
    }

    it("syncs as a job with a report: the data, the store lists and the audit log", async () => {
      expect(await data()).toMatchObject({ provinces: 0, dataset_version: null })

      const done = await sync()

      expect(done).toMatchObject({ type: "tr_address.sync", status: "succeeded", progress: 100 })
      expect(done.result_summary).toMatchObject({
        skipped: false,
        source: "turkiyeapi",
        dataset_version: "2025",
        last_updated: "2026-05-21",
        provinces: { created: 81, updated: 0, deactivated: 0 },
        districts: { created: 83 },
        neighborhoods: { created: 13 },
        rejected: 0,
      })
      expect(await data()).toEqual({
        provinces: 81,
        districts: 83,
        neighborhoods: 13,
        villages: 2,
        source: "turkiyeapi",
        dataset_version: "2025",
        last_updated: "2026-05-21",
      })
      // The storefront's contract is as before: names it writes into the address
      const sandikli = await neighborhoodsOf(TURKIYEAPI_IDS.sandikli)
      expect(sandikli.map(({ name }) => name)).toEqual([
        "Cumhuriyet (Kırka)",
        "Fatih",
        "Fatih (Akın)",
        "Fatih (Kırka)",
        "Fatih Köyü",
      ])
      expect(Object.keys(sandikli[0] ?? {}).sort()).toEqual(["id", "name", "postal_code"])
      expect(fake.requests).toContain("/v2/datasets/neighborhoods.json")

      // The operator's record: in the log, out of the shop's viewer (audit-log.spec)
      const audit = await getContainer()
        .resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
        .listAuditEntries({ resource_type: "tr_address" })
      expect(audit).toContainEqual(
        expect.objectContaining({ action: "tr_address.imported", actor_type: "system" })
      )
    })

    it("changes nothing the second time; a renamed and a removed place come through", async () => {
      await sync()
      const again = await sync()
      expect(again.result_summary).toMatchObject({
        provinces: { created: 0, updated: 0, deactivated: 0 },
        districts: { created: 0, updated: 0, deactivated: 0 },
        neighborhoods: { created: 0, updated: 0, deactivated: 0, unchanged: 13 },
      })

      const caferaga = fake.dataset.neighborhoods.find(({ name }) => name === "Caferağa")
      Object.assign(caferaga ?? {}, { name: "Caferağa Merkez" })
      fake.dataset.neighborhoods = fake.dataset.neighborhoods.filter(
        ({ name }) => name !== "Fenerbahçe"
      )
      const changed = await sync()

      expect(changed.result_summary).toMatchObject({
        neighborhoods: { created: 0, updated: 1, deactivated: 1 },
      })
      expect((await neighborhoodsOf(TURKIYEAPI_IDS.kadikoy)).map(({ name }) => name)).toEqual([
        "Caferağa Merkez",
        "Rasimpaşa",
      ])
    })

    it("offers the shop no way to read or start it: the platform keeps it", async () => {
      const status = await settle(http.get("/admin/tr-address/status", { headers: owner.headers }))
      const start = await settle(
        http.post("/admin/tr-address/sync", {}, { headers: owner.headers })
      )
      const viaJobs = await settle(
        http.post<{ message?: string }>(
          "/admin/async-jobs",
          { type: TR_ADDRESS_SYNC_JOB },
          { headers: owner.headers }
        )
      )

      expect(status.status).toBe(404)
      expect(start.status).toBe(404)
      expect(viaJobs.status).toBe(400)
      expect(viaJobs.data.message).toBe("async_job.type_unknown")
      expect(await latestJobId()).toBeNull()
      // The warehouse forms' lists stay
      expect(
        (await settle(http.get("/admin/tr-address/provinces", { headers: owner.headers }))).status
      ).toBe(200)
    })

    it("fails with its reason when TürkiyeAPI is down, logs it for the operator, keeps the data", async () => {
      await loadTrAddressFixture(getContainer())
      fake.down = true
      const errors = jest.spyOn(logger, "error")

      const failed = await sync()

      expect(failed).toMatchObject({
        status: "failed",
        error_code: "tr_address.source_unavailable",
      })
      expect(failed.error_message).toContain("TürkiyeAPI")
      expect(errors).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "tr_address.sync_failed",
          jobId: failed.id,
          code: "tr_address.source_unavailable",
        })
      )
      expect(await data()).toMatchObject({ provinces: 6, source: null })
    })

    it("pages through the lists when the dataset files fail", async () => {
      fake.failFiles = true

      expect(await sync()).toMatchObject({ status: "succeeded" })
      expect((await data()).neighborhoods).toBe(13)
      expect(fake.requests).toContain("/v2/neighborhoods")
    })

    it("checks weekly and queues a sync only for a dataset the shop does not have", async () => {
      // The scheduled job's run: the sync it queued, finished, or none
      const weekly = async () => {
        const before = await latestJobId()
        await trAddressSyncJob(getContainer())
        const after = await latestJobId()
        return after === null || after === before ? null : waitFor(after)
      }

      // No data yet: synced
      expect((await weekly())?.result_summary).toMatchObject({ skipped: false })
      fake.requests = []
      // The same dataset: one look at /meta, no job
      expect(await weekly()).toBeNull()
      expect(fake.requests).toEqual(["/v2/meta"])

      fake.lastUpdated = "2026-11-01"
      expect((await weekly())?.result_summary).toMatchObject({
        skipped: false,
        last_updated: "2026-11-01",
        neighborhoods: { created: 0, updated: 0, unchanged: 13 },
      })
      expect(await data()).toMatchObject({ last_updated: "2026-11-01" })
    })

    it("logs a failed weekly check for the operator and queues nothing", async () => {
      fake.down = true
      const errors = jest.spyOn(logger, "error")

      await trAddressSyncJob(getContainer())

      expect(errors).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "tr_address.check_failed",
          code: "tr_address.source_unavailable",
        })
      )
      expect(await latestJobId()).toBeNull()
    })

    it("holds a postal code to the neighbourhood's only when it is PTT's own", async () => {
      await sync()
      const service = trAddressService(getContainer())
      const address = (neighborhood: string, postalCode: string) =>
        validateTrAddress(service, {
          country_code: "tr",
          province: "Ankara",
          city: "Çankaya",
          address_2: neighborhood,
          postal_code: postalCode,
        })

      // Kızılay's code is official; Bahçelievler's an estimate, which the shopper may correct
      expect((await address("Kızılay", "06421")).map(({ code }) => code)).toEqual([
        "tr_address.postal_code_neighborhood_mismatch",
      ])
      expect(await address("Bahçelievler", "06491")).toEqual([])
    })
  },
})
