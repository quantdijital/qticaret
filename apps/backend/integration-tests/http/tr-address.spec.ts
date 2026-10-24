import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import type { Storefront } from "../helpers/storefront"
import { createStorefront } from "../helpers/storefront"
import { loadTrAddressFixture, trAddressService } from "../helpers/tr-address"

jest.setTimeout(120 * 1000)

interface ListResponse {
  count: number
  offset: number
  limit: number
}

type Provinces = ListResponse & { provinces: { id: string; code: string; name: string }[] }
type Districts = ListResponse & { districts: { id: string; name: string }[] }
type Neighborhoods = ListResponse & {
  neighborhoods: { id: string; name: string; postal_code: string }[]
}

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let storefront: Storefront

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      storefront = await createStorefront(container)
    })

    const get = <T>(url: string) => settle(http.get<T>(url, { headers: storefront.headers }))

    describe("GET /store/tr-address/provinces", () => {
      it("lists active provinces in Turkish alphabetical order with cache headers", async () => {
        const response = await get<Provinces>("/store/tr-address/provinces")

        expect(response.status).toBe(200)
        expect(response.data.provinces.map((province) => province.name)).toEqual([
          "Ankara",
          "Çanakkale",
          "Iğdır",
          "İstanbul",
          "İzmir",
          "Şanlıurfa",
        ])
        expect(response.data).toMatchObject({ count: 6, offset: 0, limit: 100 })
        expect(Object.keys(response.data.provinces[0] ?? {}).sort()).toEqual(["code", "id", "name"])
        expect(response.headers["cache-control"]).toContain("public")
      })

      it("paginates with limit and offset", async () => {
        const response = await get<Provinces>("/store/tr-address/provinces?limit=2&offset=2")

        expect(response.data.provinces.map((province) => province.code)).toEqual(["76", "34"])
        expect(response.data).toMatchObject({ count: 6, offset: 2, limit: 2 })
      })

      it("rejects a limit above the maximum", async () => {
        expect((await get("/store/tr-address/provinces?limit=1001")).status).toBe(400)
      })

      it("hides deactivated provinces", async () => {
        await trAddressService(getContainer()).importReferenceData(
          [{ province_code: "6", province_name: "Ankara", district_name: "Çankaya" }],
          { deactivateMissing: true }
        )

        const response = await get<Provinces>("/store/tr-address/provinces")

        expect(response.data.provinces.map((province) => province.name)).toEqual(["Ankara"])
      })

      it("requires a publishable API key", async () => {
        const response = await settle(http.get("/store/tr-address/provinces"))

        expect(response.status).toBe(400)
      })
    })

    describe("GET /store/tr-address/districts", () => {
      it.each([
        ["6", ["Çankaya", "Polatlı"]],
        ["34", ["Beşiktaş", "Kadıköy"]],
        ["81", []],
      ])("lists the districts of province %p", async (province, names) => {
        const response = await get<Districts>(`/store/tr-address/districts?province=${province}`)

        expect(response.status).toBe(200)
        expect(response.data.districts.map((district) => district.name)).toEqual(names)
        expect(response.data.count).toBe(names.length)
      })

      it.each(["", "?province=0", "?province=82", "?province=ankara"])(
        "rejects the query %p",
        async (query) => {
          expect((await get(`/store/tr-address/districts${query}`)).status).toBe(400)
        }
      )
    })

    describe("GET /store/tr-address/neighborhoods", () => {
      it("lists a district's neighborhoods with postal codes", async () => {
        const { data } = await get<Districts>("/store/tr-address/districts?province=34")
        const kadikoy = data.districts.find((district) => district.name === "Kadıköy")

        const response = await get<Neighborhoods>(
          `/store/tr-address/neighborhoods?district=${String(kadikoy?.id)}`
        )

        expect(response.status).toBe(200)
        expect(
          response.data.neighborhoods.map(({ name, postal_code }) => ({ name, postal_code }))
        ).toEqual([
          { name: "Caferağa", postal_code: "34710" },
          { name: "Fenerbahçe", postal_code: "34726" },
          { name: "Rasimpaşa", postal_code: "34716" },
        ])
      })

      it.each(["", "?district=34", "?district=trprv_01M5PY6CW6GT7W2SY3D2JJ6RP0"])(
        "rejects the query %p",
        async (query) => {
          expect((await get(`/store/tr-address/neighborhoods${query}`)).status).toBe(400)
        }
      )
    })
  },
})
