import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { CONTENT_MODULE } from ".."
import type ContentModuleService from "../service"

jest.setTimeout(120 * 1000)

const entry = (kind: "page" | "post", handle: string) => ({
  kind,
  title: "Hakkımızda",
  handle,
  body: { type: "doc", content: [] },
})

moduleIntegrationTestRunner<ContentModuleService>({
  moduleName: CONTENT_MODULE,
  resolve: "./src/modules/content",
  testSuite: ({ service }) => {
    it("keeps a draft with its document", async () => {
      const saved = await service.createContentEntries(entry("page", "hakkimizda"))
      expect(saved).toMatchObject({ status: "draft", published_at: null, kind: "page" })
      expect(saved.id).toMatch(/^cnt_/)
      expect((await service.retrieveContentEntry(saved.id)).body).toEqual({
        type: "doc",
        content: [],
      })
    })

    it("holds a handle once per kind", async () => {
      await service.createContentEntries(entry("page", "kargo"))
      await service.createContentEntries(entry("post", "kargo"))
      await expect(service.createContentEntries(entry("page", "kargo"))).rejects.toThrow()
    })

    it("counts each term's posts in one grouped statement, live or all, capped", async () => {
      const [news, tips, empty] = await service.createContentTerms([
        { kind: "category", name: "Haberler", handle: "haberler" },
        { kind: "tag", name: "İpuçları", handle: "ipuclari" },
        { kind: "tag", name: "Boş", handle: "bos" },
      ])
      const [live, draft, gone, page] = await service.createContentEntries([
        { ...entry("post", "canli"), status: "published", published_at: new Date() },
        entry("post", "taslak"),
        { ...entry("post", "silinen"), status: "published", published_at: new Date() },
        { ...entry("page", "sayfa"), status: "published", published_at: new Date() },
      ])
      const file = (entryId: string, term: { id: string; kind: "category" | "tag" }) => ({
        entry_id: entryId,
        term_id: term.id,
        term_kind: term.kind,
      })
      if (!news || !tips || !empty || !live || !draft || !gone || !page) {
        throw new Error("fixtures were not made")
      }
      await service.createContentEntryTerms([
        file(live.id, news),
        file(draft.id, news),
        file(gone.id, news),
        file(live.id, tips),
        file(draft.id, tips),
        // A page filed under a term (never, but) is no post
        file(page.id, tips),
      ])
      await service.softDeleteContentEntries([gone.id])
      const counted = async (ids: string[] | null, onlyLive: boolean, cap = 100) =>
        Object.fromEntries(
          (await service.countPostsByTerm(ids, { live: onlyLive, cap })).map((row) => [
            row.term_id,
            row.count,
          ])
        )

      expect(await counted(null, true)).toEqual({ [news.id]: 1, [tips.id]: 1 })
      expect(await counted(null, false)).toEqual({ [news.id]: 2, [tips.id]: 2 })
      expect(await counted([tips.id, empty.id], false)).toEqual({ [tips.id]: 2 })
      expect(await counted([], false)).toEqual({})
      // The fullest first: one term kept
      await service.createContentEntryTerms([file(live.id, empty)])
      expect(Object.keys(await counted(null, false, 1))).toHaveLength(1)
    })
  },
})
