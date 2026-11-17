import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import sharp from "sharp"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

type Section = Record<string, unknown> & { id: string; type: string }

interface StoreLayout {
  layout: { home: Section[]; footer: Section[] }
}

const ALWAYS = { visible: true, starts_at: null, ends_at: null }

const VECTOR =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
  '<circle cx="32" cy="32" r="30" fill="#123"/></svg>'

// An address the schema takes (https, no credentials) that is not one of the shop's uploads
const STRANGER = "https://baska.example/bulten.jpg"

/**
 * The newsletter box's picture (adr/0049 Ek 2026-11-17 e-bülten, `image_card`):
 * on a page and in the footer it is held to the media library like every
 * other picture of the design: a stranger's address and an SVG are
 * refused, the shop's own upload is kept and printed.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    describe("the newsletter box's picture", () => {
      it("takes only the library's own picture, on the home page and in the footer", async () => {
        const container = getContainer()
        const owner = await createAdminUser(http, container)
        const store = await createStorefront(container)
        const asOwner = { headers: owner.headers }

        const upload = async (file: Blob, name: string) => {
          const form = new FormData()
          form.append("files", file, name)
          const uploaded = await settle(
            http.post<{ files: { id: string }[] }>("/admin/uploads", form, asOwner)
          )
          expect(uploaded.status).toBe(200)
          const registered = await settle(
            http.post<{ media: { url: string }[] }>(
              "/admin/media",
              { file_ids: uploaded.data.files.map((file) => file.id), library: true },
              asOwner
            )
          )
          const url = registered.data.media[0]?.url ?? ""
          expect(url).not.toBe("")
          return url
        }
        const png = await sharp({
          create: { width: 60, height: 90, channels: 3, background: { r: 30, g: 32, b: 40 } },
        })
          .png()
          .toBuffer()
        const picture = await upload(
          new Blob([new Uint8Array(png)], { type: "image/png" }),
          "bulten.png"
        )
        // Taken by its content and stored cleaned, as the logo's upload is (store-svg.spec.ts)
        const vector = await upload(new Blob([VECTOR], { type: "text/plain" }), "bulten.txt")

        const box = (id: string, url: string): Section => ({
          id,
          type: "newsletter",
          ...ALWAYS,
          title: "Haberdar olun",
          text: "Onay metni.",
          variant: "image_card",
          image: { url, alt: "Tezgâh" },
        })
        const save = (home: Section[], footer: Section[]) =>
          settle(
            http.post<{ message?: string }>(
              "/admin/storefront-layout",
              { document: { header: [], home, footer, product: [], category: [] } },
              asOwner
            )
          )
        const answer = (saved: { status: number; data: { message?: string } }) => [
          saved.status,
          saved.data.message,
        ]

        // The footer's box: its picture is checked beside the pages' (layout-check.ts)
        expect(answer(await save([], [box("altbulten1", STRANGER)]))).toEqual([
          400,
          "content.image_unknown",
        ])
        expect(answer(await save([], [box("altbulten1", vector)]))).toEqual([
          400,
          "media.svg_logo_only",
        ])
        // A good picture on the page does not carry the footer's
        expect(
          answer(await save([box("sayfabulten1", picture)], [box("altbulten1", STRANGER)]))
        ).toEqual([400, "content.image_unknown"])
        expect(
          answer(await save([box("sayfabulten1", picture)], [box("altbulten1", vector)]))
        ).toEqual([400, "media.svg_logo_only"])

        // The home page's box
        expect(answer(await save([box("sayfabulten1", STRANGER)], []))).toEqual([
          400,
          "content.image_unknown",
        ])
        expect(answer(await save([box("sayfabulten1", vector)], []))).toEqual([
          400,
          "media.svg_logo_only",
        ])
        expect(
          answer(await save([box("sayfabulten1", vector)], [box("altbulten1", picture)]))
        ).toEqual([400, "media.svg_logo_only"])

        // The shop's own upload is kept in both places and printed with the box
        const saved = await save([box("sayfabulten1", picture)], [box("altbulten1", picture)])
        expect(saved.status).toBe(200)
        expect(
          (await settle(http.post("/admin/storefront-layout/publish", {}, asOwner))).status
        ).toBe(200)
        const live = await settle(
          http.get<StoreLayout>("/store/storefront-layout", { headers: store.headers })
        )
        expect(live.status).toBe(200)
        const printed = {
          type: "newsletter",
          variant: "image_card",
          image: { url: picture, alt: "Tezgâh" },
        }
        expect(live.data.layout.home).toMatchObject([{ id: "sayfabulten1", ...printed }])
        expect(live.data.layout.footer).toMatchObject([{ id: "altbulten1", ...printed }])
      })
    })
  },
})
