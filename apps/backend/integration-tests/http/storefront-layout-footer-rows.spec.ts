import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { MEDIA_MODULE } from "../../src/modules/media"
import type MediaModuleService from "../../src/modules/media/service"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

type Section = Record<string, unknown> & { id: string; type: string }
type Groups = Record<"header" | "home" | "footer" | "product" | "category", Section[]>

interface AdminLayout {
  layout: { draft: Groups; has_changes: boolean }
  message?: string
}

interface Block {
  id: string
  at: number
  type: string
  [field: string]: unknown
}

interface StoreLayout {
  layout: Groups & {
    main: Record<string, Section & { rows?: { id: string; columns: { blocks: Block[] }[] }[] }>
  }
}

const BADGE = "https://cdn.magaza.example/rozet.png"
const footer = { id: "mainfooter", type: "footer_bar", variant: "free_rows" }
const row = (blocks: unknown[][], more: Record<string, unknown> = {}) => ({
  id: "rowone001",
  layout: Array.from({ length: blocks.length }, () => "1").join("-"),
  columns: blocks.map((each) => ({ blocks: each })),
  ...more,
})
const picture = (url: string, more: Record<string, unknown> = {}) => ({
  id: "pict00001",
  type: "image",
  image: { url, alt: "Güven rozeti" },
  ...more,
})
const words = {
  id: "words0001",
  type: "text",
  title: "Kargo",
  body: {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "{mağaza_adı}: 14.00'e kadar <b>" }] },
    ],
  },
}

/**
 * adr/0070: the free rows footer ("Serbest düzen"), saved, refused and
 * printed. Its own file: the storefront's live read is held per revision in
 * process, and the database reset between tests starts the revisions again.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    /** The owner's design (read, save, publish) and the storefront's live read. */
    const open = async () => {
      const container = getContainer()
      const owner = await createAdminUser(http, container)
      const store = await createStorefront(container)
      const asOwner = { headers: owner.headers }
      return {
        container,
        admin: async () =>
          (await settle(http.get<AdminLayout>("/admin/storefront-layout", asOwner))).data.layout,
        live: async () =>
          (
            await settle(
              http.get<StoreLayout>("/store/storefront-layout", { headers: store.headers })
            )
          ).data.layout,
        save: (document: Partial<Groups>) =>
          settle(
            http.post<AdminLayout>(
              "/admin/storefront-layout",
              { document: { header: [], home: [], footer: [], ...document } },
              asOwner
            )
          ),
        publish: async () =>
          (await settle(http.post("/admin/storefront-layout/publish", {}, asOwner))).status,
      }
    }

    it("reads a footer switched to it with the starting row and holds a save to the rows' bounds", async () => {
      const { admin, save } = await open()

      expect((await save({ footer: [footer] })).status).toBe(200)
      const [bar] = (await admin()).draft.footer
      expect(bar).toMatchObject({
        ...footer,
        ground: "well",
        badge_style: "card",
        bottom_badges: true,
      })
      const rows = bar?.["rows"] as { layout: string; columns: { blocks: Block[] }[] }[]
      expect(rows).toHaveLength(1)
      expect(rows[0]?.layout).toBe("2-1-1-1")
      expect(rows[0]?.columns.map((column) => column.blocks[0]?.type)).toEqual([
        "brand",
        "menu",
        "menu",
        "contact",
      ])

      const menu = (slot: number, id = `menu0000${String(slot)}`) => ({ id, type: "menu", slot })
      const refused: [unknown, string][] = [
        [{ ...footer, rows: [] }, "footer_rows_limit"],
        [{ ...footer, rows: [row([[], []], { layout: "1-1-1" })] }, "footer_columns_mismatch"],
        [
          { ...footer, rows: [row([[1, 2, 3, 4, 5, 6, 7].map((slot) => menu(slot))])] },
          "footer_blocks_limit",
        ],
        [
          {
            ...footer,
            rows: [
              row([[{ id: "brand0001", type: "brand" }], [{ id: "brand0002", type: "brand" }]]),
            ],
          },
          "footer_blocks_limit",
        ],
        [
          { ...footer, rows: [row([[{ id: "html00001", type: "html", html: "<script>" }]])] },
          "footer_block_invalid",
        ],
        [{ ...footer, rows: [row([[menu(11)]])] }, "footer_block_invalid"],
        [
          {
            ...footer,
            rows: [
              row([
                [
                  {
                    ...words,
                    body: {
                      type: "doc",
                      content: [
                        {
                          type: "heading",
                          attrs: { level: 2 },
                          content: [{ type: "text", text: "x" }],
                        },
                      ],
                    },
                  },
                ],
              ]),
            ],
          },
          "footer_block_invalid",
        ],
        [
          {
            ...footer,
            rows: [
              row([
                [{ id: "apps00001", type: "app_badges", app_store: "https://evil.example/app" }],
              ]),
            ],
          },
          "footer_block_invalid",
        ],
        [
          {
            ...footer,
            rows: [
              row([
                [{ id: "apps00001", type: "app_badges", app_store: "http://apps.apple.com/app" }],
              ]),
            ],
          },
          "footer_block_invalid",
        ],
        [
          { ...footer, rows: [row([[menu(1, "sameid001"), menu(2, "sameid001")]])] },
          "section_duplicate",
        ],
      ]
      for (const [section, key] of refused) {
        const answer = await save({ footer: [section as Section] })
        expect([key, answer.status]).toEqual([key, 400])
        expect(answer.data.message).toContain(`storefront_layout.${key}`)
      }

      // One newsletter form to a page: the block, or the group's box
      const twice = await save({
        footer: [
          { ...footer, rows: [row([[{ id: "news00001", type: "newsletter" }]])] },
          { id: "footernews", type: "newsletter" },
        ],
      })
      expect(twice.status).toBe(400)
      expect(twice.data.message).toContain("storefront_layout.footer_newsletter_twice")
    })

    it("refuses a picture that is not the media library's, and prints the rows resolved for the storefront", async () => {
      const { container, live, save, publish } = await open()
      await container
        .resolve<MediaModuleService>(MEDIA_MODULE)
        // As an upload leaves it: a file behind the address
        .createMediaAssets([{ url: BADGE, file_id: "footer-rows-badge", width: 240, height: 120 }])

      const outside = await save({
        footer: [{ ...footer, rows: [row([[picture("https://evil.example/x.png")]])] }],
      })
      expect(outside.status).toBe(400)
      expect(outside.data.message).toContain("content.image_unknown")

      // A picture's link names a record that exists
      const gone = await save({
        footer: [
          {
            ...footer,
            rows: [
              row([
                [picture(BADGE, { link: { kind: "category", target: "pcat_yok", label: null } })],
              ]),
            ],
          },
        ],
      })
      expect(gone.status).toBe(400)
      expect(gone.data.message).toContain("storefront_layout.target_unknown")

      const saved = await save({
        footer: [
          {
            ...footer,
            ground: "stage",
            rows: [
              row([
                [{ id: "hidden001", type: "social", visible: false }, words],
                [picture(BADGE, { link: { kind: "system", target: "shop", label: "Mağaza" } })],
                [{ id: "menu00002", type: "menu", slot: 2, device: "desktop" }],
              ]),
            ],
          },
        ],
      })
      expect(saved.status).toBe(200)
      expect(await publish()).toBe(200)

      const bar = (await live()).main["footer_bar"]
      expect(bar).toMatchObject({
        ...footer,
        ground: "stage",
        badge_style: "card",
        bottom_badges: true,
      })
      const columns = bar?.rows?.[0]?.columns ?? []
      expect(
        columns.map((column) => column.blocks.map((block) => `${block.id}@${String(block.at)}`))
      ).toEqual([["words0001@1"], ["pict00001@2"], ["menu00002@3"]])
      const [text] = columns[0]?.blocks ?? []
      expect(text).toMatchObject({ type: "text", title: "Kargo" })
      // The backend's HTML: the shop's name in place, what was typed escaped
      expect(text?.["html"]).toContain("kadar &lt;b&gt;</p>")
      expect(text?.["html"]).not.toContain("<b>")
      expect(text?.["html"]).not.toContain("{mağaza_adı}")
      expect(columns[1]?.blocks[0]).toMatchObject({
        type: "image",
        width: "medium",
        image: { url: BADGE, alt: "Güven rozeti", width: 240, height: 120 },
        link: { kind: "system", target: "shop", label: "Mağaza" },
      })
      expect(columns[2]?.blocks[0]).toMatchObject({ type: "menu", slot: 2, device: "desktop" })
    })
  },
})
