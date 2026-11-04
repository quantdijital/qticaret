import { resolve } from "node:path"
import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { TURKIYEAPI_IDS, fakeTurkiyeApiDataset } from "@qticaret/testing"
import type { FakeTurkiyeApiDataset } from "@qticaret/testing"
import { readAddressRows } from "../../../lib/tr-address/file/read-rows"
import { toImportRows } from "../../../lib/tr-address/turkiyeapi/map"
import { TR_ADDRESS_MODULE } from ".."
import type TrAddressModuleService from "../service"

jest.setTimeout(300 * 1000)

const FIXTURE = resolve(__dirname, "../../../../integration-tests/fixtures/tr-address.csv")
const SYNC = {
  source: "turkiyeapi" as const,
  dataset_version: "2025",
  dataset_last_updated: "2026-05-21",
}

const rowsOf = (dataset: FakeTurkiyeApiDataset) => toImportRows(dataset).rows
const neighborhood = (dataset: FakeTurkiyeApiDataset, name: string) => {
  const found = dataset.neighborhoods.find((each) => each.name === name)
  if (!found) {
    throw new Error(`no ${name} in the fake dataset`)
  }
  return found
}

/** adr/0008 Ek 2026-11-04: TürkiyeAPI's dataset through the import, run after run. */
moduleIntegrationTestRunner<TrAddressModuleService>({
  moduleName: TR_ADDRESS_MODULE,
  resolve: "./src/modules/tr-address",
  testSuite: ({ service }) => {
    const sync = (dataset: FakeTurkiyeApiDataset) =>
      service.importReferenceData(rowsOf(dataset), { shouldDeactivateMissing: true, sync: SYNC })
    const names = async (districtExternalId: number) => {
      const [district] = await service.listTrDistricts({
        external_id: `turkiyeapi:district:${String(districtExternalId)}`,
      })
      const list = await service.listTrNeighborhoods(
        { district_id: district?.id ?? "-", is_active: true },
        { order: { sort_key: "ASC" } }
      )
      return list.map((each) => each.name)
    }

    it("loads the whole dataset and records it; a second run changes nothing", async () => {
      const dataset = fakeTurkiyeApiDataset()
      const first = await sync(dataset)

      expect(first.rejected).toEqual([])
      expect(first.provinces.created).toBe(81)
      expect(first.districts.created).toBe(83)
      expect(first.neighborhoods.created).toBe(13)
      expect(await service.countActive()).toEqual({
        provinces: 81,
        districts: 83,
        neighborhoods: 13,
        villages: 2,
      })
      // Sorted by letters: the town's parentheses do not count
      expect(await names(TURKIYEAPI_IDS.sandikli)).toEqual([
        "Cumhuriyet (Kırka)",
        "Fatih",
        "Fatih (Akın)",
        "Fatih (Kırka)",
        "Fatih Köyü",
      ])

      const second = await sync(dataset)
      for (const level of [second.provinces, second.districts, second.neighborhoods]) {
        expect(level).toMatchObject({ created: 0, updated: 0, deactivated: 0 })
      }
      const syncs = await service.listTrAddressSyncs({})
      expect(syncs).toHaveLength(2)
      expect(await service.latestSync()).toMatchObject({
        source: "turkiyeapi",
        dataset_version: "2025",
        dataset_last_updated: "2026-05-21",
      })
    })

    it("updates a renamed place in place and marks a removed one inactive", async () => {
      const dataset = fakeTurkiyeApiDataset()
      await sync(dataset)
      const caferaga = neighborhood(dataset, "Caferağa")
      const [before] = await service.listTrNeighborhoods({
        external_id: `turkiyeapi:neighborhood:${String(caferaga.id)}`,
      })

      caferaga.name = "Caferağa Merkez"
      const adalar = dataset.districts.find((each) => each.id === TURKIYEAPI_IDS.adalar)
      Object.assign(adalar ?? {}, { name: "Adalar Yeni" })
      dataset.neighborhoods = dataset.neighborhoods.filter((each) => each.name !== "Burgazada")
      const report = await sync(dataset)

      expect(report.neighborhoods).toMatchObject({ created: 0, updated: 1, deactivated: 1 })
      expect(report.districts).toMatchObject({ created: 0, updated: 1, deactivated: 0 })
      const [after] = await service.listTrNeighborhoods({ id: before?.id ?? "-" })
      expect(after).toMatchObject({ name: "Caferağa Merkez", is_active: true })
      const [burgazada] = await service.listTrNeighborhoods({ name: "Burgazada" })
      expect(burgazada?.is_active).toBe(false)
    })

    it("swaps two names, and keeps a place whose id changed under the same name", async () => {
      const dataset = fakeTurkiyeApiDataset()
      await sync(dataset)
      const caferaga = neighborhood(dataset, "Caferağa")
      const rasimpasa = neighborhood(dataset, "Rasimpaşa")

      caferaga.name = "Rasimpaşa"
      rasimpasa.name = "Caferağa"
      neighborhood(dataset, "Fenerbahçe").id = 99_001
      const report = await sync(dataset)

      expect(report.neighborhoods).toMatchObject({ created: 0, updated: 3, deactivated: 0 })
      expect(await names(TURKIYEAPI_IDS.kadikoy)).toEqual(["Caferağa", "Fenerbahçe", "Rasimpaşa"])
      const fenerbahce = await service.listTrNeighborhoods({ name: "Fenerbahçe" })
      expect(fenerbahce.map((each) => each.external_id)).toEqual(["turkiyeapi:neighborhood:99001"])
    })

    it("lets a removed place keep its name beside an active one", async () => {
      const dataset = fakeTurkiyeApiDataset()
      await sync(dataset)
      const burgazada = neighborhood(dataset, "Burgazada")

      // Renamed away while a new place takes its name; the new one goes; the old name comes back
      burgazada.name = "Yeni Ada"
      const newcomer = { ...burgazada, id: 99_002, name: "Burgazada" }
      dataset.neighborhoods.push(newcomer)
      expect((await sync(dataset)).neighborhoods).toMatchObject({ created: 1, updated: 1 })
      dataset.neighborhoods = dataset.neighborhoods.filter((each) => each !== newcomer)
      expect((await sync(dataset)).neighborhoods).toMatchObject({ deactivated: 1 })
      burgazada.name = "Burgazada"
      expect((await sync(dataset)).neighborhoods).toMatchObject({ updated: 1, created: 0 })

      const both = await service.listTrNeighborhoods({ name: "Burgazada" })
      expect(both.map((each) => each.is_active).sort()).toEqual([false, true])
    })

    it("moves a neighbourhood to its new district", async () => {
      const dataset = fakeTurkiyeApiDataset()
      await sync(dataset)

      neighborhood(dataset, "Burgazada").districtId = TURKIYEAPI_IDS.kadikoy
      const report = await sync(dataset)

      expect(report.neighborhoods).toMatchObject({ updated: 1, deactivated: 0 })
      expect(await names(TURKIYEAPI_IDS.kadikoy)).toContain("Burgazada")
      expect(await names(TURKIYEAPI_IDS.adalar)).toEqual([])
    })

    it("takes over a hand-made sample: same records, the rest marked inactive", async () => {
      await service.importReferenceData(await readAddressRows(FIXTURE))
      const [kadikoy] = await service.listTrDistricts({ name: "Kadıköy" })

      const report = await sync(fakeTurkiyeApiDataset())

      // Kadıköy, Çankaya and the Merkez of Iğdır and Çanakkale are the sample's already
      expect(report.districts.created).toBe(83 - 4)
      const [after] = await service.listTrDistricts({ id: kadikoy?.id ?? "-" })
      expect(after).toMatchObject({
        is_active: true,
        external_id: `turkiyeapi:district:${String(TURKIYEAPI_IDS.kadikoy)}`,
      })
      // Beşiktaş is the sample's, not the dataset's
      const [besiktas] = await service.listTrDistricts({ name: "Beşiktaş" })
      expect(besiktas?.is_active).toBe(false)
      expect((await service.countActive()).provinces).toBe(81)
    })

    it("keeps TürkiyeAPI's ids and statuses through a later file import", async () => {
      await sync(fakeTurkiyeApiDataset())

      const report = await service.importReferenceData([
        {
          province_code: "34",
          province_name: "İstanbul",
          district_name: "Kadıköy",
          neighborhood_name: "Rasimpaşa",
          postal_code: "34716",
        },
      ])

      expect(report.neighborhoods).toMatchObject({ created: 0, updated: 0, unchanged: 1 })
      const [rasimpasa] = await service.listTrNeighborhoods({ name: "Rasimpaşa" })
      expect(rasimpasa).toMatchObject({ postal_code_status: "derived", kind: "neighborhood" })
      expect(rasimpasa?.external_id).toMatch(/^turkiyeapi:neighborhood:/)
    })
  },
})
