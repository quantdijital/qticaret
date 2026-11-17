import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { AUDIT_LOG_MODULE } from "../../src/modules/audit-log"
import type AuditLogModuleService from "../../src/modules/audit-log/service"
import { createAdminUser } from "../helpers/admin"
import { clearDesigns, helpBox, staffClient, storedDesigns } from "../helpers/designs"
import type { DesignCard } from "../helpers/designs"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(240 * 1000)

const BADGES = [{ icon: "truck", title: "Aynı gün kargo", text: null }]

/**
 * The saved looks (adr/0064 Ek 2026-11-17): the draft kept before a look
 * replaces it, only when it holds something new; five automatic saves and
 * ten named ones at most; who may write them, and what is recorded.
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
      const own = {
        ...opened.draft,
        home: [helpBox("yardimkutusu", "Bize yazın")],
        settings: { ...opened.draft.settings, trust_badges: BADGES },
      }
      expect((await staff.saveDraft(own)).status).toBe(200)
      return { owner, staff, own }
    }

    it("keeps the replaced draft as an automatic save, only when it holds something new", async () => {
      const { staff } = await ownerWithDraft()
      const empty = await staff.gallery()
      expect(empty).toMatchObject({ designs: [], limits: { saved: 10, auto: 5 } })

      // The shop's own design, replaced by Grafit: kept
      const first = await staff.applyPreset("general", "grafit")
      expect(first.status).toBe(200)
      expect(first.data.result.auto_saved).toEqual({
        id: expect.stringMatching(/^sfd_/) as unknown,
        kind: "auto",
        name: null,
      })
      expect(first.data.layout.draft.settings.design).toEqual({
        id: null,
        digest: expect.stringMatching(/^[0-9a-f]{64}$/) as unknown,
      })
      let gallery = await staff.gallery()
      expect(gallery.designs).toHaveLength(1)
      expect(gallery.designs[0]).toMatchObject({
        kind: "auto",
        name: null,
        in_draft: false,
        summary: { source: "own", source_name: null, edited: false, reason: "preset_apply" },
      })
      expect(gallery.current.draft).toMatchObject({
        preset: { pack: "general", code: "grafit" },
        design_id: null,
        edited: false,
        has_changes: true,
      })

      // Grafit unchanged, applied again: nothing new to keep
      const again = await staff.applyPreset("general", "grafit")
      expect(again.data.result.auto_saved).toBeNull()

      // Edited, then replaced: kept, named after Grafit and marked edited
      const edited = {
        ...again.data.layout.draft,
        home: again.data.layout.draft.home.filter((section) => section.id !== "blogyazilari"),
      }
      await staff.saveDraft(edited)
      expect((await staff.gallery()).current.draft.edited).toBe(true)
      const replaced = await staff.applyPreset("general", "grafit")
      expect(replaced.data.result.auto_saved).toMatchObject({ kind: "auto" })
      gallery = await staff.gallery()
      expect(gallery.designs).toHaveLength(2)
      expect(gallery.designs[0]?.summary).toMatchObject({
        source: "preset",
        source_name: "Grafit",
        preset: { pack: "general", code: "grafit" },
        edited: true,
        reason: "preset_apply",
      })

      // The same edit made again: a saved look already holds it
      await staff.saveDraft(edited)
      expect((await staff.applyPreset("general", "grafit")).data.result.auto_saved).toBeNull()
      expect((await staff.gallery()).designs).toHaveLength(2)

      // No document in any answer, and none kept with a menu set or a label
      expect(JSON.stringify(gallery)).not.toContain('"document"')
      for (const row of await storedDesigns(getContainer())) {
        expect(row.document.settings).toMatchObject({ menus: null, design: null })
        // The shop's own data stays in the copy (it is the draft as it was)
        expect(row.document.settings?.["trust_badges"]).toEqual(BADGES)
      }
    })

    it("keeps the latest five automatic saves, the named ones whatever their age", async () => {
      const { staff, own } = await ownerWithDraft()
      const named = await staff.saveDesign({ name: "Benim tasarımım" })
      expect(named.status).toBe(200)
      expect(named.data.design).toMatchObject({ kind: "saved", name: "Benim tasarımım" })

      const autos: string[] = []
      for (let round = 1; round <= 6; round++) {
        await staff.saveDraft({
          ...own,
          home: [helpBox("yardimkutusu", `Bize yazın ${String(round)}`)],
        })
        const applied = await staff.applyPreset("general", "grafit")
        expect(applied.status).toBe(200)
        autos.push(applied.data.result.auto_saved?.id ?? "none")
      }
      const gallery = await staff.gallery()
      const ids = (kind: DesignCard["kind"]) =>
        gallery.designs.filter((each) => each.kind === kind).map((each) => each.id)
      // Newest first; the first one gone
      expect(ids("auto")).toEqual(autos.slice(1).reverse())
      expect(ids("saved")).toEqual([named.data.design?.id])
    })

    it("names ten looks at most, one per name in Turkish lower case; save_as is all or nothing", async () => {
      const { staff, own } = await ownerWithDraft()
      expect((await staff.saveDesign({ name: "İstanbul" })).status).toBe(200)
      const taken = await staff.saveDesign({ name: "  istanbul " })
      expect(taken.status).toBe(409)
      expect(taken.data.message).toBe("storefront_design.name_taken")
      for (const body of [
        { name: "" },
        { name: "   " },
        { name: "x".repeat(61) },
        { name: "a\u0000b" },
        { name: 7 },
        { name: "Yeni", document: { home: [] } },
        { name: "Yeni", revision: 0 },
      ]) {
        const refused = await staff.saveDesign(body)
        expect(refused.status).toBe(400)
      }
      for (const name of ["", "x".repeat(61), "a\u0000b"]) {
        const refused = await staff.saveDesign({ name })
        expect(refused.data.message).toBe("storefront_design.name_invalid")
      }
      expect((await staff.saveDesign({ name: "Yeni" })).status).toBe(200)
      for (let at = 3; at <= 9; at++) {
        expect((await staff.saveDesign({ name: `Görünüm ${String(at)}` })).status).toBe(200)
      }

      // The tenth, named while applying: the draft kept by name, no automatic save
      const tenth = await staff.applyPreset("general", "grafit", { save_as: "Önceki hâli" })
      expect(tenth.status).toBe(200)
      expect(tenth.data.result.auto_saved).toMatchObject({ kind: "saved", name: "Önceki hâli" })
      let gallery = await staff.gallery()
      expect(gallery.designs.filter((each) => each.kind === "saved")).toHaveLength(10)
      expect(gallery.designs.filter((each) => each.kind === "auto")).toHaveLength(0)

      const full = await staff.saveDesign({ name: "On birinci" })
      expect(full.status).toBe(409)
      expect(full.data.message).toBe("storefront_design.limit_reached")

      // Past the ten, save_as refuses the apply whole: the draft is as it was
      await staff.saveDraft({ ...own, home: [helpBox("yardimkutusu", "Değişti")] })
      const before = await staff.layout()
      const refused = await staff.applyPreset("general", "grafit", { save_as: "Bir daha" })
      expect(refused.status).toBe(409)
      expect(refused.data.message).toBe("storefront_design.limit_reached")
      expect((await staff.layout()).draft).toEqual(before.draft)
      gallery = await staff.gallery()
      expect(gallery.designs).toHaveLength(10)
    })

    it("lets every staff member read, only the owner and admins write, and records each write", async () => {
      const container = getContainer()
      const { staff } = await ownerWithDraft()
      const saved = await staff.saveDesign({ name: "Kayıt" })
      const id = saved.data.design?.id ?? ""
      expect(id).toMatch(/^sfd_/)

      // Signed out
      expect((await settle(http.get("/admin/storefront-designs"))).status).toBe(401)
      expect((await settle(http.post("/admin/storefront-designs", { name: "x" }))).status).toBe(401)

      for (const role of ["operations", "readonly"] as const) {
        const member = staffClient(http, (await createAdminUser(http, container, role)).headers)
        expect((await member.get("/admin/storefront-designs")).status).toBe(200)
        expect((await member.saveDesign({ name: `Rol ${role}` })).status).toBe(403)
        expect(
          (await member.post(`/admin/storefront-designs/${id}`, { name: "Yeni" })).status
        ).toBe(403)
        expect((await member.remove(`/admin/storefront-designs/${id}`)).status).toBe(403)
        expect((await member.applyDesign(id)).status).toBe(403)
      }
      const admin = staffClient(http, (await createAdminUser(http, container, "admin")).headers)
      expect((await admin.saveDesign({ name: "Yöneticinin" })).status).toBe(200)

      // The owner's four kinds of write, each recorded on the saved look
      expect(
        (await staff.post(`/admin/storefront-designs/${id}`, { name: "Kayıt 2" })).status
      ).toBe(200)
      expect((await staff.applyDesign(id)).status).toBe(200)
      expect((await staff.remove(`/admin/storefront-designs/${id}`)).status).toBe(200)
      const audit = container.resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
      const routes = [
        "POST /admin/storefront-designs",
        "POST /admin/storefront-designs/:id",
        "POST /admin/storefront-designs/:id/apply",
        "DELETE /admin/storefront-designs/:id",
      ]
      const entries = await eventually(
        () =>
          audit.listAuditEntries(
            { resource_type: "storefront_design", outcome: 200 },
            { select: ["action", "resource_id", "changes"] }
          ),
        (found) => routes.every((route) => found.some((each) => each.action === route))
      )
      for (const route of routes) {
        expect(entries.map((each) => each.action)).toContain(route)
      }
      // The save names the made look by the handler's note; the others by the path
      const written = entries.filter((each) => each.resource_id === id)
      expect(written.map((each) => each.action).sort()).toEqual([...routes].sort())
      // A look's document is never written to the record
      expect(JSON.stringify(entries)).not.toContain('"home"')
    })

    it("serves a ready-made look's picture only for the gallery's looks, and widens its cards", async () => {
      const { staff } = await ownerWithDraft()
      const container = getContainer()
      const presets = await staff.get<{ presets: Record<string, unknown>[] }>(
        "/admin/storefront-presets"
      )
      const grafit = presets.data.presets.find((each) => each["code"] === "grafit")
      expect(grafit).toMatchObject({
        family: "grafit",
        swatch: null,
        has_header: false,
        has_footer: true,
        has_preview: true,
        summary: {
          source: "preset",
          source_name: "Grafit",
          preset: { pack: "general", code: "grafit" },
          edited: false,
          reason: null,
        },
      })
      expect(grafit?.["preview_url"]).toMatch(
        /^\/admin\/storefront-presets\/general\/grafit\/preview\?v=\d+$/
      )
      expect(grafit).not.toHaveProperty("layout")

      // Its picture (`pnpm preset:previews`), sent as an image only
      const picture = await staff.get("/admin/storefront-presets/general/grafit/preview")
      expect(picture.status).toBe(200)
      expect(picture.headers["content-type"]).toMatch(/^image\/webp/)
      expect(picture.headers["x-content-type-options"]).toBe("nosniff")

      // Signed out; a pack not applied here; a code no pack writes
      expect(
        (await settle(http.get("/admin/storefront-presets/general/grafit/preview"))).status
      ).toBe(401)
      for (const path of ["cutlery/tezgah", "general/Grafit", "general/..%2Fgrafit", "yok/yok"]) {
        expect((await staff.get(`/admin/storefront-presets/${path}/preview`)).status).toBe(404)
      }
      const operations = staffClient(
        http,
        (await createAdminUser(http, container, "operations")).headers
      )
      expect(
        (await operations.get("/admin/storefront-presets/general/grafit/preview")).status
      ).toBe(404)
    })
  },
})
