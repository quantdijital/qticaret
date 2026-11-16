import { asValue } from "@medusajs/framework/awilix"
import { createMedusaContainer } from "@medusajs/framework/utils"
import { BRANDS_MODULE } from "../../../modules/brands"
import { ensureBrands } from "../brands"
import { uploadDemoImage } from "../images"
import { demoCatalogSchema } from "../schema"

const saveRun = jest.fn()
const deriveRun = jest.fn()
const fillRun = jest.fn()
jest.mock("../../../workflows/brands/workflows", () => ({
  saveBrandWorkflow: () => ({ run: saveRun }),
}))
jest.mock("../../../workflows/brands/backfill-logo-sizes", () => ({
  fillBrandLogoSizes: (...args: unknown[]) => fillRun(...args) as unknown,
}))
jest.mock("../../../workflows/media/workflows", () => ({
  deriveLibraryMediaWorkflow: () => ({ run: deriveRun }),
}))
jest.mock("../images", () => ({ uploadDemoImage: jest.fn() }))

const upload = jest.mocked(uploadDemoImage)
const brands = { listBrands: jest.fn() }

function container() {
  const made = createMedusaContainer()
  made.register({ [BRANDS_MODULE]: asValue(brands) })
  return made
}

const catalog = (rows: unknown[]) =>
  demoCatalogSchema.parse({ name: "demo-test", brands: rows, categories: [], products: [] })

beforeEach(() => {
  jest.clearAllMocks()
  brands.listBrands.mockResolvedValue([])
  saveRun.mockImplementation(({ input }: { input: { id?: string; values: { handle?: string } } }) =>
    Promise.resolve({ result: { id: input.id ?? `brand_${input.values.handle ?? ""}` } })
  )
  upload.mockImplementation((_container, source) =>
    Promise.resolve({ id: `media_${source.file}`, file_id: `file_${source.file}` } as never)
  )
})

describe("the demo catalogue's brands", () => {
  it("takes a logo as an image file, never an SVG or a path", () => {
    const row = { handle: "atolye", name: "Atölye" }
    expect(catalog([{ ...row, logo: "atolye-logo.png" }]).brands[0]?.logo).toBe("atolye-logo.png")
    expect(catalog([row]).brands[0]?.logo).toBeUndefined()
    for (const logo of ["atolye-logo.svg", "../atolye.png", "logos/atolye.png"]) {
      expect(() => catalog([{ ...row, logo }])).toThrow()
    }
  })

  it("makes a missing brand with its logo, uploaded into the library with its versions", async () => {
    const result = await ensureBrands(
      container(),
      catalog([
        { handle: "atolye", name: "Atölye", logo: "atolye-logo.png" },
        { handle: "yalin", name: "Yalın" },
      ]),
      "/demo/images"
    )

    expect(upload).toHaveBeenCalledTimes(1)
    expect(upload).toHaveBeenCalledWith(
      expect.anything(),
      { dir: "/demo/images", file: "atolye-logo.png" },
      "marka-atolye",
      true
    )
    expect(deriveRun).toHaveBeenCalledWith({ input: { ids: ["media_atolye-logo.png"] } })
    expect(saveRun.mock.calls.map(([call]) => (call as { input: unknown }).input)).toEqual([
      {
        values: {
          name: "Atölye",
          handle: "atolye",
          description: null,
          logo_file_id: "file_atolye-logo.png",
        },
      },
      { values: { name: "Yalın", handle: "yalin", description: null, logo_file_id: null } },
    ])
    expect(result).toEqual({
      ids: new Map([
        ["atolye", "brand_atolye"],
        ["yalin", "brand_yalin"],
      ]),
      created: 2,
      logos: 1,
    })
  })

  it("gives a brand already here the file's logo only when it has none, and keeps the rest", async () => {
    brands.listBrands.mockResolvedValue([
      { id: "brand_1", handle: "atolye", logo_file_id: null },
      { id: "brand_2", handle: "yalin", logo_file_id: "file_own" },
      { id: "brand_3", handle: "sade", logo_file_id: null },
    ])
    const result = await ensureBrands(
      container(),
      catalog([
        { handle: "atolye", name: "Atölye", logo: "atolye-logo.png" },
        { handle: "yalin", name: "Yalın", logo: "yalin-logo.png" },
        { handle: "sade", name: "Sade" },
      ]),
      "/demo/images"
    )

    expect(upload).toHaveBeenCalledTimes(1)
    expect(saveRun).toHaveBeenCalledTimes(1)
    expect(saveRun).toHaveBeenCalledWith({
      input: { id: "brand_1", values: { logo_file_id: "file_atolye-logo.png" } },
    })
    expect(result).toEqual({
      ids: new Map([
        ["atolye", "brand_1"],
        ["yalin", "brand_2"],
        ["sade", "brand_3"],
      ]),
      created: 0,
      logos: 1,
    })
    // A logo set before sizes were kept (brand_2's) gets its size; the step skips sized ones
    expect(fillRun).toHaveBeenCalledWith(expect.anything(), {
      apply: true,
      ids: ["brand_1", "brand_2", "brand_3"],
    })
  })

  it("does nothing on a second run once every logo is in", async () => {
    brands.listBrands.mockResolvedValue([
      { id: "brand_1", handle: "atolye", logo_file_id: "file_atolye-logo.png" },
    ])
    const result = await ensureBrands(
      container(),
      catalog([{ handle: "atolye", name: "Atölye", logo: "atolye-logo.png" }]),
      "/demo/images"
    )
    expect(upload).not.toHaveBeenCalled()
    expect(saveRun).not.toHaveBeenCalled()
    expect(result.logos).toBe(0)
  })
})
