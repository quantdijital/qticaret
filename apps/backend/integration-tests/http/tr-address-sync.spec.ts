import type { MedusaContainer } from "@medusajs/framework/types"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { TURKIYEAPI_IDS, fakeTurkiyeApiDataset, startFakeTurkiyeApi } from "@qticaret/testing"
import type { FakeTurkiyeApi } from "@qticaret/testing"
import trAddressSyncJob from "../../src/jobs/tr-address-sync"
import { validateTrAddress } from "../../src/modules/tr-address/validation"
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

interface Status {
  provinces: number
  districts: number
  neighborhoods: number
  villages: number
  source: string | null
  dataset_version: string | null
  last_updated: string | null
  last_sync_at: string | null
  job: Job | null
}

const finished = (job: Job | undefined) =>
  job !== undefined && job.status !== "queued" && job.status !== "running"

/** adr/0008 Ek 2026-11-04: the address data from TürkiyeAPI (a fake one here; never the real API). */
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

    const status = async (headers = owner.headers) =>
      (await http.get<Status>("/admin/tr-address/status", { headers })).data
    const job = async (id: string) =>
      (await http.get<{ async_job: Job }>(`/admin/async-jobs/${id}`, { headers: owner.headers }))
        .data.async_job
    const waitFor = (id: string) => eventually(() => job(id), finished, 150)
    const sync = async () => {
      const started = await settle(
        http.post<{ async_job: Job }>("/admin/tr-address/sync", {}, { headers: owner.headers })
      )
      expect(started.status).toBe(202)
      return waitFor(started.data.async_job.id)
    }
    const districtId = async (container: MedusaContainer, externalId: number) =>
      (
        await trAddressService(container).listTrDistricts({
          external_id: `turkiyeapi:district:${String(externalId)}`,
        })
      )[0]?.id ?? "-"
    const neighborhoodsOf = async (externalId: number) =>
      (
        await http.get<{ neighborhoods: { name: string; postal_code: string }[] }>(
          `/store/tr-address/neighborhoods?district=${await districtId(getContainer(), externalId)}`,
          { headers: storefront.headers }
        )
      ).data.neighborhoods

    it("the owner syncs: a job with a report, the status, the lists and the audit log", async () => {
      expect(await status()).toMatchObject({ provinces: 0, dataset_version: null, job: null })

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
      expect(await status()).toMatchObject({
        provinces: 81,
        districts: 83,
        neighborhoods: 13,
        villages: 2,
        source: "turkiyeapi",
        dataset_version: "2025",
        last_updated: "2026-05-21",
        job: { id: done.id, status: "succeeded" },
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

      const audit = await http.get<{ audit_entries: { action: string; changes: unknown }[] }>(
        "/admin/audit-log?resource_type=tr_address&limit=10",
        { headers: owner.headers }
      )
      expect(audit.data.audit_entries.map((entry) => entry.action)).toContain("tr_address.imported")
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

    it("is the owner's to start; every role reads the status", async () => {
      const admin = await createAdminUser(http, getContainer(), "admin")
      const readonly = await createAdminUser(http, getContainer(), "readonly")

      const refused = await settle(
        http.post("/admin/tr-address/sync", {}, { headers: admin.headers })
      )
      expect(refused.status).toBe(403)
      expect(
        (await settle(http.get("/admin/tr-address/status", { headers: readonly.headers }))).status
      ).toBe(200)
      const extra = await settle(
        http.post("/admin/tr-address/sync", { source: "file" }, { headers: owner.headers })
      )
      expect(extra.status).toBe(400)
    })

    it("fails with its reason when TürkiyeAPI is down, and leaves the data as it was", async () => {
      await loadTrAddressFixture(getContainer())
      fake.down = true

      const failed = await sync()

      expect(failed).toMatchObject({
        status: "failed",
        error_code: "tr_address.source_unavailable",
      })
      expect(failed.error_message).toContain("TürkiyeAPI")
      expect(await status()).toMatchObject({ provinces: 6, source: null })
    })

    it("pages through the lists when the dataset files fail", async () => {
      fake.failFiles = true

      expect(await sync()).toMatchObject({ status: "succeeded" })
      expect((await status()).neighborhoods).toBe(13)
      expect(fake.requests).toContain("/v2/neighborhoods")
    })

    it("checks weekly and queues a sync only for a dataset the shop does not have", async () => {
      // The scheduled job's run: the sync it queued, finished, or none
      const weekly = async () => {
        const before = (await status()).job?.id ?? null
        await trAddressSyncJob(getContainer())
        const after = await eventually(
          () => status(),
          (now) => now.job === null || now.job.id === before || finished(now.job),
          150
        )
        return after.job?.id === before ? null : after.job
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
      expect(await status()).toMatchObject({ last_updated: "2026-11-01" })
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
