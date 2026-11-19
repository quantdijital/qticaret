import type { MedusaContainer } from "@medusajs/framework/types"
import { recordsByHandle } from "../preset-lookups"

interface Graph {
  entity: string
  fields: string[]
  filters: Record<string, unknown>
}

/** A container whose query answers each entity with these rows, keeping what it was asked. */
function shopWith(rows: Record<string, Record<string, unknown>[]>) {
  const asked: Graph[] = []
  const query = {
    graph: (args: Graph) => {
      asked.push(args)
      const handles = args.filters["handle"] as string[]
      return Promise.resolve({
        data: (rows[args.entity] ?? []).filter((row) => handles.includes(row["handle"] as string)),
      })
    },
  }
  const container = { resolve: () => query } as unknown as Pick<MedusaContainer, "resolve">
  return { container, asked }
}

describe("a preset's page found in the shop (adr/0073 §4)", () => {
  it("finds a content page by its handle, a draft one too, never a post", async () => {
    const { container, asked } = shopWith({
      content_entry: [
        { id: "cnt_about", handle: "hakkimizda", kind: "page", status: "draft" },
        { id: "cnt_contact", handle: "iletisim", kind: "page", status: "published" },
        { id: "cnt_post", handle: "bicak-bakimi", kind: "post", status: "published" },
      ],
    })

    const found = await recordsByHandle(container, [
      "page:hakkimizda",
      "page:iletisim",
      "page:bicak-bakimi",
      "page:sss",
    ])

    expect(found).toEqual(
      new Map([
        ["page:hakkimizda", "cnt_about"],
        ["page:iletisim", "cnt_contact"],
      ])
    )
    // Asked by handle alone: a page's state never hides it from a look
    expect(asked).toEqual([
      {
        entity: "content_entry",
        fields: ["id", "handle", "kind"],
        filters: { handle: ["hakkimizda", "iletisim", "bicak-bakimi", "sss"] },
      },
    ])
  })
})
