import { fakeTurkiyeApiDataset } from "@qticaret/testing"
import { toImportRows, villageName } from "../map"

const rowsOf = () => toImportRows(fakeTurkiyeApiDataset())

describe("toImportRows", () => {
  it("makes a district row for every district, with its TürkiyeAPI id", () => {
    const { rows } = rowsOf()
    const districtRows = rows.filter((row) => row.neighborhood_name === undefined)

    expect(districtRows).toHaveLength(83)
    expect(districtRows).toContainEqual({
      province_code: 34,
      province_name: "İstanbul",
      district_name: "Kadıköy",
      district_external_id: "turkiyeapi:district:1034",
    })
  })

  it("names a town's neighbourhoods after their town, and villages as villages", () => {
    const { rows } = rowsOf()
    const sandikli = rows
      .filter((row) => row.district_name === "Sandıklı" && row.neighborhood_name)
      .map((row) => [row.neighborhood_name, row.neighborhood_kind, row.postal_code])

    expect(sandikli).toEqual([
      ["Fatih", "neighborhood", "03500"],
      ["Fatih (Kırka)", "neighborhood", "03510"],
      ["Cumhuriyet (Kırka)", "neighborhood", "03510"],
      ["Fatih (Akın)", "neighborhood", "03520"],
      ["Fatih Köyü", "village", "03530"],
    ])
  })

  it("keeps ids and postal code statuses; anything unknown counts as an estimate", () => {
    const dataset = fakeTurkiyeApiDataset()
    const rasimpasa = dataset.neighborhoods.find((each) => each.name === "Rasimpaşa")
    if (!rasimpasa) {
      throw new Error("fixture changed")
    }
    Object.assign(rasimpasa, { postalCodeStatus: "guessed" })
    const row = toImportRows(dataset).rows.find((each) => each.neighborhood_name === "Rasimpaşa")

    expect(row).toMatchObject({
      neighborhood_external_id: `turkiyeapi:neighborhood:${String(rasimpasa.id)}`,
      postal_code_status: "estimated",
    })
    const alcali = toImportRows(dataset).rows.find(
      (each) => each.neighborhood_name === "Alcalı Köyü"
    )
    expect(alcali).toMatchObject({
      neighborhood_external_id: "turkiyeapi:village:20001",
      postal_code_status: "official",
      district_name: "Merkez",
      province_code: 3,
    })
  })

  it("leaves out records whose district is missing, and counts them", () => {
    const dataset = fakeTurkiyeApiDataset()
    const [alcali] = dataset.villages
    if (!alcali) {
      throw new Error("fixture changed")
    }
    dataset.villages.push({ ...alcali, id: 29_999, districtId: 999_999 })

    expect(toImportRows(dataset).orphans).toBe(1)
  })

  it("gives the same rows whatever order the records come in", () => {
    const dataset = fakeTurkiyeApiDataset()
    const reversed = {
      ...dataset,
      districts: [...dataset.districts].reverse(),
      neighborhoods: [...dataset.neighborhoods].reverse(),
    }

    expect(toImportRows(reversed).rows).toEqual(toImportRows(dataset).rows)
  })

  it("does not add the village suffix twice", () => {
    expect(villageName("Yeniköy")).toBe("Yeniköy Köyü")
    expect(villageName(" Alcalı Köyü ")).toBe("Alcalı Köyü")
  })
})
