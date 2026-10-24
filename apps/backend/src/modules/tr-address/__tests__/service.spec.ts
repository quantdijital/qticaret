import { resolve } from "node:path"
import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { readAddressRows } from "../../../scripts/tr-address/read-rows"
import { TR_ADDRESS_MODULE } from ".."
import type TrAddressModuleService from "../service"

jest.setTimeout(300 * 1000)

const FIXTURE = resolve(__dirname, "../../../../integration-tests/fixtures/tr-address.csv")

moduleIntegrationTestRunner<TrAddressModuleService>({
  moduleName: TR_ADDRESS_MODULE,
  resolve: "./src/modules/tr-address",
  testSuite: ({ service }) => {
    describe("importReferenceData", () => {
      it("loads the fixture and normalizes plate codes", async () => {
        const report = await service.importReferenceData(await readAddressRows(FIXTURE))

        expect(report.rejected).toEqual([])
        expect(report.provinces.created).toBe(6)
        expect(report.districts.created).toBe(8)
        expect(report.neighborhoods.created).toBe(11)
        const [ankara] = await service.listTrProvinces({ code: "06" })
        expect(ankara?.name).toBe("Ankara")
      })

      it("is idempotent: a second import changes nothing", async () => {
        const rows = await readAddressRows(FIXTURE)
        await service.importReferenceData(rows)
        const second = await service.importReferenceData(rows)

        for (const level of [second.provinces, second.districts, second.neighborhoods]) {
          expect(level).toMatchObject({ created: 0, updated: 0, deactivated: 0 })
        }
        expect(await service.listTrNeighborhoods()).toHaveLength(11)
      })

      it("rejects bad rows without affecting the valid ones", async () => {
        const report = await service.importReferenceData([
          {
            province_code: "34",
            province_name: "İstanbul",
            district_name: "Kadıköy",
            neighborhood_name: "Caferağa",
            postal_code: "34710",
          },
          {
            province_code: "34",
            province_name: "İstanbul",
            district_name: "Kadıköy",
            neighborhood_name: "Yanlış",
            postal_code: "06100",
          },
          { province_code: "99", province_name: "Yok", district_name: "Yok" },
          { province_code: "34", province_name: "Istanbul", district_name: "Şişli" },
          {
            province_code: "34",
            province_name: "İstanbul",
            district_name: "KADIKÖY",
            neighborhood_name: "Caferağa Mah.",
            postal_code: "34711",
          },
          { province_name: "Eksik" },
        ])

        expect(report.rejected).toEqual([
          { row: 2, reason: "postal_code_mismatch" },
          { row: 3, reason: "invalid_province_code" },
          { row: 4, reason: "province_name_conflict" },
          { row: 5, reason: "neighborhood_postal_code_conflict" },
          { row: 6, reason: "invalid_shape" },
        ])
        expect(report.neighborhoods.created).toBe(1)
      })

      it("updates changed places and, when asked, deactivates missing ones", async () => {
        await service.importReferenceData(await readAddressRows(FIXTURE))

        const report = await service.importReferenceData(
          [
            {
              province_code: "34",
              province_name: "İstanbul",
              district_name: "Kadıköy",
              neighborhood_name: "Caferağa",
              postal_code: "34711",
            },
          ],
          { shouldDeactivateMissing: true }
        )

        expect(report.neighborhoods).toMatchObject({ updated: 1, deactivated: 10 })
        expect(report.provinces).toMatchObject({ unchanged: 1, deactivated: 5 })
        const [caferaga] = await service.listTrNeighborhoods({ match_key: "CAFERAĞA" })
        expect(caferaga?.postal_code).toBe("34711")
        expect(await service.listTrNeighborhoods({ is_active: true })).toHaveLength(1)

        const restored = await service.importReferenceData(await readAddressRows(FIXTURE))
        expect(restored.neighborhoods.updated).toBe(11)
        expect(await service.listTrNeighborhoods({ is_active: true })).toHaveLength(11)
      })
    })

    describe("lookupAddress", () => {
      beforeEach(async () => {
        await service.importReferenceData(await readAddressRows(FIXTURE))
      })

      it("matches names with Turkish casing and the neighborhood suffix", async () => {
        const lookup = await service.lookupAddress({
          province: "istanbul",
          district: "KADIKÖY",
          neighborhood: "caferağa mahallesi",
        })

        expect(lookup).toMatchObject({
          province: { code: "34", name: "İstanbul" },
          district: { name: "Kadıköy" },
          neighborhood: { name: "Caferağa", postal_code: "34710" },
          districtHasNeighborhoods: true,
        })
      })

      it("does not find a district under another province", async () => {
        const lookup = await service.lookupAddress({ province: "Ankara", district: "Kadıköy" })

        expect(lookup.province?.code).toBe("06")
        expect(lookup.district).toBeUndefined()
      })

      it("reports districts that have no neighborhood data", async () => {
        const lookup = await service.lookupAddress({ province: "Ankara", district: "Polatlı" })

        expect(lookup.district?.name).toBe("Polatlı")
        expect(lookup.districtHasNeighborhoods).toBe(false)
      })
    })

    describe("bulk import performance", () => {
      it("loads a national-size dataset (~32k neighborhoods) and reimports it", async () => {
        const rows = []
        for (let plate = 1; plate <= 81; plate++) {
          const code = String(plate).padStart(2, "0")
          for (let d = 1; d <= 12; d++) {
            for (let n = 1; n <= 33; n++) {
              rows.push({
                province_code: code,
                province_name: `İl ${code}`,
                district_name: `İlçe ${String(d)}`,
                neighborhood_name: `Mahalle ${String(n)}`,
                postal_code: `${code}${String(d * 33 + n).padStart(3, "0")}`,
              })
            }
          }
        }

        let startedAt = Date.now()
        const first = await service.importReferenceData(rows)
        const firstMs = Date.now() - startedAt
        startedAt = Date.now()
        const second = await service.importReferenceData(rows)
        const secondMs = Date.now() - startedAt
        process.stdout.write(
          `tr-address bulk import: ${String(rows.length)} rows, first ${String(firstMs)} ms, rerun ${String(secondMs)} ms\n`
        )

        expect(first.neighborhoods.created).toBe(rows.length)
        expect(second.neighborhoods.unchanged).toBe(rows.length)
        expect(firstMs).toBeLessThan(120_000)
      })
    })
  },
})
