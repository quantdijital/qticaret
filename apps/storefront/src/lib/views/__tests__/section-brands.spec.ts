import { beforeEach, describe, expect, it, vi } from "vitest"
import type { StoreBrand } from "@qticaret/types"

// The home page's brands section: each brand at its page, its logo when it has one
const requests = vi.hoisted(() => ({
  allCategories: vi.fn(),
  listProducts: vi.fn(),
  pathsOf: vi.fn((_type: string, ids: readonly string[]) =>
    Promise.resolve(
      Object.fromEntries(ids.filter((id) => id !== "b_gizli").map((id) => [id, `/marka/${id}`]))
    )
  ),
  priceDisplays: vi.fn(() => Promise.resolve({})),
}))
vi.mock("@/lib/store-api/requests", () => requests)
vi.mock("@/lib/store-api/extras", () => ({
  cardFacts: vi.fn(() => Promise.resolve({})),
  categoryImages: vi.fn(() => Promise.resolve(new Map())),
  latestReviewPhotos: vi.fn(() => Promise.resolve([])),
}))
const server = vi.hoisted(() => ({ storeGet: vi.fn(), storePublicGet: vi.fn() }))
vi.mock("@/lib/store-api/server", () => server)

const { brandLinks } = await import("../section-data")

const brand = (id: string, name: string, logo: string | null = null): StoreBrand => ({
  id,
  name,
  handle: id,
  logo_url: logo,
})

beforeEach(() => {
  server.storeGet.mockResolvedValue({
    brands: [
      brand("b_ada", "Ada"),
      brand("b_bora", "Bora", "https://cdn.example/bora.png"),
      brand("b_gizli", "Gizli", "https://cdn.example/gizli.png"),
    ],
  })
})

describe("the brands section's brands", () => {
  it("gives a brand with a logo its logo, named by the brand, and one without only its name", async () => {
    expect(await brandLinks([])).toEqual([
      { label: "Ada", path: "/marka/b_ada" },
      {
        label: "Bora",
        path: "/marka/b_bora",
        logo: {
          src: "https://cdn.example/bora.png",
          alt: "Bora",
          width: null,
          height: null,
          sources: { avif: null, webp: null },
        },
      },
    ])
  })

  it("gives a logo the size the server read, so the section saves its room", async () => {
    server.storeGet.mockResolvedValue({
      brands: [
        {
          ...brand("b_bora", "Bora", "https://cdn.example/bora.png"),
          logo_width: 300,
          logo_height: 100,
        },
      ],
    })
    const [bora] = await brandLinks([])
    expect(bora?.logo).toMatchObject({
      src: "https://cdn.example/bora.png",
      width: 300,
      height: 100,
    })
  })

  it("keeps the order the section names them in", async () => {
    const links = await brandLinks(["b_bora", "b_yok", "b_ada"])
    expect(links.map((link) => link.label)).toEqual(["Bora", "Ada"])
  })
})
