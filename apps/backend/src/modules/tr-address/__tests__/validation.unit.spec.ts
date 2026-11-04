import type { TrAddressLookup } from "../service"
import { evaluateTrAddress } from "../validation"

const istanbul = { id: "p34", code: "34", name: "İstanbul" }
const kadikoy = { id: "d1", name: "Kadıköy" }
const caferaga = { id: "n1", name: "Caferağa", postal_code: "34710", postal_code_status: null }

const full: TrAddressLookup = {
  province: istanbul,
  district: kadikoy,
  neighborhood: caferaga,
  districtHasNeighborhoods: true,
}

const codes = (address: Parameters<typeof evaluateTrAddress>[0], lookup: TrAddressLookup) =>
  evaluateTrAddress(address, lookup).map((issue) => `${issue.field}:${issue.code}`)

describe("evaluateTrAddress", () => {
  it("accepts a consistent address", () => {
    expect(
      codes(
        {
          country_code: "tr",
          province: "İstanbul",
          city: "Kadıköy",
          address_2: "Caferağa",
          postal_code: "34710",
          phone: "0532 123 45 67",
        },
        full
      )
    ).toEqual([])
  })

  it("accepts a partial address with only a country", () => {
    expect(codes({ country_code: "tr" }, { districtHasNeighborhoods: false })).toEqual([])
  })

  it("flags an unknown province", () => {
    expect(codes({ province: "Atlantis" }, { districtHasNeighborhoods: false })).toEqual([
      "province:tr_address.province_not_found",
    ])
  })

  it("flags a district outside its province and a district without province", () => {
    expect(
      codes(
        { province: "İstanbul", city: "Çankaya" },
        { province: istanbul, districtHasNeighborhoods: false }
      )
    ).toEqual(["city:tr_address.district_not_in_province"])
    expect(codes({ city: "Kadıköy" }, { districtHasNeighborhoods: false })).toEqual([
      "city:tr_address.district_requires_province",
    ])
  })

  it("checks the neighborhood only where the district has reference data", () => {
    const withoutNeighborhood: TrAddressLookup = {
      province: istanbul,
      district: kadikoy,
      districtHasNeighborhoods: true,
    }
    const address = { province: "İstanbul", city: "Kadıköy", address_2: "Yok" }

    expect(codes(address, withoutNeighborhood)).toEqual([
      "address_2:tr_address.neighborhood_not_in_district",
    ])
    expect(codes(address, { ...withoutNeighborhood, districtHasNeighborhoods: false })).toEqual([])
    expect(
      codes(
        { province: "İstanbul", address_2: "Caferağa" },
        { province: istanbul, districtHasNeighborhoods: false }
      )
    ).toEqual(["address_2:tr_address.neighborhood_requires_district"])
  })

  it.each([
    ["3471", "postal_code:tr_address.postal_code_invalid"],
    ["06420", "postal_code:tr_address.postal_code_province_mismatch"],
    ["34726", "postal_code:tr_address.postal_code_neighborhood_mismatch"],
  ])("flags postal code %p", (postalCode, expected) => {
    expect(
      codes(
        { province: "İstanbul", city: "Kadıköy", address_2: "Caferağa", postal_code: postalCode },
        full
      )
    ).toEqual([expected])
  })

  it("holds the postal code to the neighborhood's only when that code is PTT's own", () => {
    const address = {
      province: "İstanbul",
      city: "Kadıköy",
      address_2: "Caferağa",
      postal_code: "34726",
    }
    const withStatus = (status: "official" | "derived" | "estimated"): TrAddressLookup => ({
      ...full,
      neighborhood: { ...caferaga, postal_code_status: status },
    })

    expect(codes(address, withStatus("official"))).toEqual([
      "postal_code:tr_address.postal_code_neighborhood_mismatch",
    ])
    expect(codes(address, withStatus("derived"))).toEqual([])
    expect(codes(address, withStatus("estimated"))).toEqual([])
    // Still the province's: an estimate does not open other provinces' codes
    expect(codes({ ...address, postal_code: "06420" }, withStatus("estimated"))).toEqual([
      "postal_code:tr_address.postal_code_province_mismatch",
    ])
  })

  it("flags a non-Turkish phone number", () => {
    expect(codes({ phone: "+44 20 7946 0958" }, { districtHasNeighborhoods: false })).toEqual([
      "phone:tr_address.phone_invalid",
    ])
  })
})
