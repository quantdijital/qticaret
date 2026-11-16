import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { Knex } from "@medusajs/framework/mikro-orm/knex"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import sharp from "sharp"
import { createAdminUser } from "../helpers/admin"
import {
  clearDesigns,
  designService,
  helpBox,
  staffClient,
  storedDesigns,
} from "../helpers/designs"
import type { AdminLayout, DesignCard, Draft } from "../helpers/designs"
import type { HttpClient } from "../helpers/http"

jest.setTimeout(240 * 1000)

const OWN_BADGES = [{ icon: "truck", title: "Aynı gün kargo", text: null }]
const NEW_BADGES = [{ icon: "shield", title: "Güvenli ödeme", text: null }]

/**
 * A saved look brought back into the draft (adr/0064 §4, Ek 2026-11-17):
 * its sections and theme, the shop's own data and menus left as they are;
 * a revision restored and the draft discarded keep the draft first; a look
 * naming a record gone is refused whole; its images stay in use.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    async function ownerWithDraft() {
      const container = getContainer()
      await clearDesigns(container)
      const owner = await createAdminUser(http, container)
      const staff = staffClient(http, owner.headers)
      const opened = await staff.layout()
      const own: Draft = {
        ...opened.draft,
        home: [helpBox("yardimkutusu", "Bize yazın")],
        settings: { ...opened.draft.settings, trust_badges: OWN_BADGES },
      }
      expect((await staff.saveDraft(own)).status).toBe(200)
      return { owner, staff, own }
    }

    it("brings a saved look into the draft, the shop's data and menus kept, and follows it", async () => {
      const { staff } = await ownerWithDraft()
      const saved = await staff.saveDesign({ name: "Benim" })
      const id = saved.data.design?.id ?? ""
      expect(saved.data.design).toMatchObject({ kind: "saved", in_draft: false, applied_at: null })

      // Grafit applied, then the shop changes its badges (its own data, not the look)
      await staff.applyPreset("general", "grafit")
      const grafit = await staff.layout()
      await staff.saveDraft({
        ...grafit.draft,
        settings: { ...grafit.draft.settings, trust_badges: NEW_BADGES },
      })

      const applied = await staff.applyDesign(id)
      expect(applied.status).toBe(200)
      expect(applied.data.result).toEqual({
        design: { id, kind: "saved", name: "Benim" },
        // Only the badges changed since Grafit: nothing new to keep
        auto_saved: null,
        skipped: [],
        dropped: [],
      })
      const draft = applied.data.layout.draft
      expect(draft.home.map((section) => section.id)).toEqual(["yardimkutusu"])
      expect(draft.settings.trust_badges).toEqual(NEW_BADGES)
      expect(draft.settings.menus).toBeNull()
      expect(draft.settings.design).toMatchObject({ id })

      const card = async (): Promise<DesignCard | undefined> =>
        (await staff.gallery()).designs.find((each) => each.id === id)
      expect(await card()).toMatchObject({ in_draft: true, live: false, edited: false })
      expect((await card())?.applied_at).toEqual(expect.any(String))
      expect((await staff.gallery()).current.draft).toMatchObject({ design_id: id, edited: false })

      await staff.saveDraft({ ...draft, home: [helpBox("yardimkutusu", "Bize yazın, hemen")] })
      expect(await card()).toMatchObject({ in_draft: true, edited: true })
      expect((await staff.post("/admin/storefront-layout/publish")).status).toBe(200)
      expect(await card()).toMatchObject({ in_draft: true, live: true })
      expect((await staff.gallery()).current.live).toMatchObject({ design_id: id })
    })

    it("names an automatic save into a named one, removes for good, and finds no other id", async () => {
      const { staff } = await ownerWithDraft()
      const applied = await staff.applyPreset("general", "grafit")
      const auto = applied.data.result.auto_saved?.id ?? ""
      expect(auto).toMatch(/^sfd_/)

      const named = await staff.post<{ design: DesignCard }>(`/admin/storefront-designs/${auto}`, {
        name: "  Eski hâli ",
      })
      expect(named.status).toBe(200)
      expect(named.data.design).toMatchObject({ id: auto, kind: "saved", name: "Eski hâli" })
      expect(
        (await staff.post(`/admin/storefront-designs/${auto}`, { name: "x", kind: "auto" })).status
      ).toBe(400)

      const removed = await staff.remove(`/admin/storefront-designs/${auto}`)
      expect(removed.status).toBe(200)
      expect(removed.data).toEqual({ id: auto, object: "storefront_design", deleted: true })
      for (const answer of [
        await staff.remove(`/admin/storefront-designs/${auto}`),
        await staff.post(`/admin/storefront-designs/${auto}`, { name: "Yine" }),
        await staff.applyDesign(auto),
        await staff.applyDesign("prod_01ABC"),
        await staff.applyDesign("sfd_01A%2F..%2Fx"),
      ]) {
        expect(answer.status).toBe(404)
        expect(answer.data.message).toBe("storefront_design.unknown")
      }
      expect((await staff.gallery()).designs).toEqual([])
    })

    it("keeps the draft before a restore and a discard, and saves a kept publication by name", async () => {
      const { staff, own } = await ownerWithDraft()
      const publish = async () => {
        const published = await staff.post<AdminLayout>("/admin/storefront-layout/publish")
        expect(published.status).toBe(200)
        return published.data.layout.revision
      }
      const firstRevision = await publish()
      await staff.saveDraft({ ...own, home: [helpBox("yardimkutusu", "İkinci")] })
      await publish()

      // Edited, then the first publication restored: the edit kept
      await staff.saveDraft({ ...own, home: [helpBox("yardimkutusu", "Üçüncü")] })
      const restored = await staff.post<{ auto_saved: { kind: string } | null }>(
        `/admin/storefront-layout/revisions/${String(firstRevision)}/restore`
      )
      expect(restored.status).toBe(200)
      expect(restored.data.auto_saved).toMatchObject({ kind: "auto" })

      // Edited, then discarded: kept; discarded again (the draft is what is live): nothing new
      await staff.saveDraft({ ...own, home: [helpBox("yardimkutusu", "Dördüncü")] })
      const discarded = await staff.post<{ auto_saved: { kind: string } | null }>(
        "/admin/storefront-layout/discard"
      )
      expect(discarded.data.auto_saved).toMatchObject({ kind: "auto" })
      const twice = await staff.post<{ auto_saved: unknown }>("/admin/storefront-layout/discard")
      expect(twice.data.auto_saved).toBeNull()
      const kept = (await storedDesigns(getContainer())).map(
        (row) => (row.document.home?.[0] as { title?: string } | undefined)?.title
      )
      expect(kept.sort()).toEqual(["Dördüncü", "Üçüncü"])

      const first = await staff.saveDesign({ name: "İlk yayın", revision: firstRevision })
      expect(first.status).toBe(200)
      expect(first.data.design).toMatchObject({ kind: "saved", name: "İlk yayın" })
      const stored = (await storedDesigns(getContainer())).find(
        (row) => row.id === first.data.design?.id
      )
      expect((stored?.document.home?.[0] as { title?: string } | undefined)?.title).toBe(
        "Bize yazın"
      )
      expect((await staff.saveDesign({ name: "Yok", revision: 9999 })).status).toBe(404)
    })

    it("refuses a look naming a record gone, whole: the draft and the saved looks as they were", async () => {
      const container = getContainer()
      const { staff } = await ownerWithDraft()
      const [category] = await container
        .resolve(Modules.PRODUCT)
        .createProductCategories([{ name: "Çakılar", handle: "cakilar-gecici", is_active: true }])
      const grafit = (await staff.applyPreset("general", "grafit")).data.layout.draft
      const withCategory = {
        ...grafit,
        home: grafit.home.map((section) =>
          section.type === "categories" ? { ...section, category_ids: [category?.id] } : section
        ),
      }
      expect((await staff.saveDraft(withCategory)).status).toBe(200)
      const saved = await staff.saveDesign({ name: "Kategorili" })
      const id = saved.data.design?.id ?? ""
      await container.resolve(Modules.PRODUCT).deleteProductCategories([category?.id ?? ""])

      // Something new in the draft, which an apply would keep first
      await staff.saveDraft({ ...grafit, home: [helpBox("yardimkutusu", "Yeni")] })
      const before = await staff.layout()
      const looks = await storedDesigns(container)

      const refused = await staff.applyDesign(id)
      expect(refused.status).toBe(400)
      expect(refused.data.message).toBe("storefront_layout.target_unknown")
      expect((await staff.layout()).draft).toEqual(before.draft)
      expect((await storedDesigns(container)).map((row) => row.id).sort()).toEqual(
        looks.map((row) => row.id).sort()
      )
      const [row] = await designService(container).listStorefrontDesigns(
        { id },
        { select: ["applied_at"] }
      )
      expect(row?.applied_at).toBeNull()
    })

    it("keeps an image a saved look shows in use, and says which look", async () => {
      const container = getContainer()
      const { owner, staff } = await ownerWithDraft()
      const png = await sharp({
        create: { width: 64, height: 48, channels: 3, background: { r: 40, g: 90, b: 160 } },
      })
        .png()
        .toBuffer()
      const form = new FormData()
      form.append("files", new Blob([new Uint8Array(png)], { type: "image/png" }), "gorunum.png")
      const uploaded = await http.post<{ files: { id: string }[] }>("/admin/uploads", form, {
        headers: owner.headers,
      })
      const registered = await staff.post<{ media: { id: string; url: string }[] }>(
        "/admin/media",
        { file_ids: uploaded.data.files.map((file) => file.id), library: true }
      )
      const image = registered.data.media[0]
      if (!image) {
        throw new Error("no media registered")
      }
      // Only a saved look holds it (written as the workflow writes one)
      const look = await designService(container).createStorefrontDesigns({
        kind: "saved",
        name: "Afişli",
        name_key: "afişli",
        document: {
          home: [{ id: "giris", type: "hero", image: { url: image.url, alt: "Afiş" } }],
          settings: { menus: null, design: null },
        },
        digest: "f".repeat(64),
        summary: {},
        created_by: owner.userId,
      })

      const detail = await staff.get<{ media: { usage: { kind: string; id: string | null }[] } }>(
        `/admin/media/${image.id}`
      )
      expect(detail.data.media.usage).toContainEqual(
        expect.objectContaining({ kind: "storefront_design", id: look.id })
      )
      const refused = await staff.remove(`/admin/media/${image.id}`)
      expect(refused.status).toBe(409)
      expect(refused.data.message).toBe("media.in_use")
      const knex = container.resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION)
      expect(await knex("media_asset").where("id", image.id).whereNull("deleted_at")).toHaveLength(
        1
      )
    })
  },
})
