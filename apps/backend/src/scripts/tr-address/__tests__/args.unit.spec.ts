import { parseImportArgs } from "../args"

describe("parseImportArgs", () => {
  it.each([[["source=turkiyeapi"]], [["--source=turkiyeapi"]], [["--source", "turkiyeapi"]]])(
    "reads TürkiyeAPI as the source from %p",
    (args) => {
      expect(parseImportArgs(args)).toEqual({ source: "turkiyeapi", only_if_changed: false })
    }
  )

  it("skips a dataset the shop has already with if-changed", () => {
    expect(parseImportArgs(["source=turkiyeapi", "if-changed"])).toEqual({
      source: "turkiyeapi",
      only_if_changed: true,
    })
  })

  it("takes a data file, with deactivate-missing in either spelling", () => {
    expect(parseImportArgs(["/data/adres.csv"])).toEqual({
      source: "file",
      file_path: "/data/adres.csv",
      deactivate_missing: false,
    })
    expect(parseImportArgs(["adres.json", "--deactivate-missing"])).toMatchObject({
      deactivate_missing: true,
    })
    expect(parseImportArgs(["source=file", "adres.csv", "deactivate-missing"])).toMatchObject({
      file_path: "adres.csv",
      deactivate_missing: true,
    })
  })

  it("refuses an unknown source, or none at all", () => {
    expect(() => parseImportArgs(["source=ptt"])).toThrow("source=turkiyeapi")
    expect(() => parseImportArgs([])).toThrow("source=turkiyeapi")
    expect(() => parseImportArgs(["source=file"])).toThrow(".csv or .json")
  })
})
