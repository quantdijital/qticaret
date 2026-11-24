import { join } from "node:path"
import { assertCompiledPackages, uncompiledPackages } from "../compiled-packages"

const at = (folder: string) => (name: string) => join("/repo/packages", name, folder, "index.js")

describe("the shared packages a deployed shop loads (adr/0061 Ek C10)", () => {
  it("names each package resolved to its TypeScript source", () => {
    expect(uncompiledPackages(at("src"))).toEqual([
      "@qticaret/server-kit",
      "@qticaret/types/control-plane",
      "@qticaret/types/panel-map",
      "@qticaret/sector-packs",
    ])
    expect(uncompiledPackages(at("dist"))).toEqual([])
  })

  it("refuses a deployed boot on source, and lets this machine and the tests run from it", () => {
    expect(() => {
      assertCompiledPackages(false, at("src"))
    }).toThrow("--conditions=qt-compiled")
    expect(() => {
      assertCompiledPackages(false, at("dist"))
    }).not.toThrow()
    expect(() => {
      assertCompiledPackages(true, at("src"))
    }).not.toThrow()
    // The test run itself loads the source, as development does
    expect(uncompiledPackages()).toHaveLength(4)
  })
})
