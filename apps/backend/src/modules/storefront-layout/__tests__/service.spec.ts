import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { STOREFRONT_LAYOUT_MODULE } from ".."
import type StorefrontLayoutModuleService from "../service"

jest.setTimeout(120 * 1000)

moduleIntegrationTestRunner<StorefrontLayoutModuleService>({
  moduleName: STOREFRONT_LAYOUT_MODULE,
  resolve: "./src/modules/storefront-layout",
  testSuite: ({ service }) => {
    it("keeps a draft apart from what is published", async () => {
      const layout = await service.createStorefrontLayouts({
        draft: { home: [{ id: "a1b2c3", type: "posts" }] },
      })
      expect(layout).toMatchObject({ published: null, revision: 0, published_at: null })

      await service.updateStorefrontLayouts({
        id: layout.id,
        published: layout.draft,
        published_at: new Date(),
        revision: 1,
      })
      const [stored] = await service.listStorefrontLayouts({})
      expect(stored?.published).toEqual({ home: [{ id: "a1b2c3", type: "posts" }] })
      expect(stored?.revision).toBe(1)
    })

    it("keeps one revision per number", async () => {
      const revision = { document: {}, published_at: new Date() }
      await service.createStorefrontLayoutRevisions({ ...revision, revision: 1 })
      await expect(
        service.createStorefrontLayoutRevisions({ ...revision, revision: 1 })
      ).rejects.toThrow()
    })

    it("sums up the kept revisions newest first with their menu set only, not the document", async () => {
      const at = new Date("2026-11-01T09:00:00.000Z")
      const menus = [{ title: "Ana menü", location: "main", items: [] }]
      await service.createStorefrontLayoutRevisions([
        { revision: 1, document: { home: [{ id: "a" }], settings: { menus } }, published_at: at },
        {
          revision: 2,
          document: { home: [{ id: "b" }] },
          published_at: at,
          published_by: "user_1",
        },
      ])
      const gone = await service.createStorefrontLayoutRevisions({
        revision: 3,
        document: {},
        published_at: at,
      })
      await service.softDeleteStorefrontLayoutRevisions(gone.id)

      const summaries = await service.revisionSummaries()

      expect(summaries).toEqual([
        { revision: 2, published_at: at, published_by: "user_1", menus: null },
        { revision: 1, published_at: at, published_by: null, menus },
      ])
    })

    describe("saved looks (adr/0064 Ek 2026-11-17)", () => {
      const look = (kind: "saved" | "auto", name: string | null, digest = "a".repeat(64)) => ({
        kind,
        name,
        name_key: name === null ? null : name.toLocaleLowerCase("tr-TR"),
        document: { home: [{ id: "a1b2c3", type: "posts" }], settings: { menus: null } },
        digest,
        summary: { source: "own", reason: "manual" },
        created_by: "user_1",
      })

      it("keeps one named look per name, its key in Turkish lower case", async () => {
        await service.createStorefrontDesigns(look("saved", "İstanbul"))
        await expect(service.createStorefrontDesigns(look("saved", "istanbul"))).rejects.toThrow()
        expect(await service.listStorefrontDesigns({ kind: "saved" })).toHaveLength(1)
      })

      it("takes any number of automatic looks with no name, and a removed name back", async () => {
        await service.createStorefrontDesigns([look("auto", null), look("auto", null)])
        expect(await service.listStorefrontDesigns({ kind: "auto" })).toHaveLength(2)

        const gone = await service.createStorefrontDesigns(look("saved", "Kış"))
        await service.softDeleteStorefrontDesigns(gone.id)
        const again = await service.createStorefrontDesigns(look("saved", "Kış"))
        expect(again.id).not.toBe(gone.id)
        expect(again.id).toMatch(/^sfd_/)
      })

      it("an automatic look's key does not hold a name: a named one of any name is taken", async () => {
        await service.createStorefrontDesigns({ ...look("auto", null), name_key: "yaz" })
        await expect(service.createStorefrontDesigns(look("saved", "Yaz"))).resolves.toMatchObject({
          kind: "saved",
        })
      })

      it("sums up the looks newest first without their documents, the removed left out", async () => {
        const first = await service.createStorefrontDesigns(look("saved", "Bir", "b".repeat(64)))
        const second = await service.createStorefrontDesigns(look("auto", null, "c".repeat(64)))
        const gone = await service.createStorefrontDesigns(look("saved", "Üç"))
        await service.softDeleteStorefrontDesigns(gone.id)

        const summaries = await service.designSummaries()

        expect(summaries.map((row) => row.id)).toEqual([second.id, first.id])
        for (const row of summaries) {
          expect(row).not.toHaveProperty("document")
          expect(Object.keys(row).sort()).toEqual(
            [
              "applied_at",
              "created_at",
              "created_by",
              "digest",
              "id",
              "kind",
              "name",
              "summary",
              "updated_at",
            ].sort()
          )
        }
        expect(summaries[1]).toMatchObject({
          kind: "saved",
          name: "Bir",
          digest: "b".repeat(64),
          summary: { source: "own", reason: "manual" },
          created_by: "user_1",
          applied_at: null,
        })
      })
    })
  },
})
