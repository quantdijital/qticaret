import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { SEARCH_INDEX_MODULE } from "../../src/modules/search-index"
import type SearchIndexModuleService from "../../src/modules/search-index/service"
import { createAdminUser } from "../helpers/admin"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { among, searchKit } from "../helpers/search"
import { indexCatalogue } from "../helpers/search-index"
import type { SearchKit } from "../helpers/search"

jest.setTimeout(180 * 1000)

interface Synonym {
  id: string
  terms: string[]
}

interface Answer {
  synonym?: Synonym
  synonyms?: Synonym[]
  count?: number
  message?: string
}

interface IndexStatus {
  documents: number
  pending: number
  last_rebuilt_at: string | null
  dictionary_words: number
  synonyms: number
}

/**
 * adr/0056: the shop's synonym groups, managed in the panel and read by
 * every search at once; the index's status beside them.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let kit: SearchKit
    let headers: Record<string, string>
    const index = () => getContainer().resolve<SearchIndexModuleService>(SEARCH_INDEX_MODULE)

    beforeEach(async () => {
      kit = await searchKit(http, getContainer())
      headers = (await createAdminUser(http, getContainer())).headers
    })

    // The groups' cache outlives the database reset between tests
    afterEach(async () => {
      await index().invalidateSynonyms()
    })

    const post = (url: string, body: unknown) => settle(http.post<Answer>(url, body, { headers }))
    const get = (url: string) => settle(http.get<Answer>(url, { headers }))
    const remove = (url: string) => settle(http.delete<Answer>(url, { headers }))

    it("keeps a group's terms once each, refuses a group of one or a long phrase", async () => {
      const made = await post("/admin/search/synonyms", { terms: ["Tişört", "t  shirt", "TİŞÖRT"] })
      expect(made.status).toBe(201)
      expect(made.data.synonym?.terms).toEqual(["tişört", "t shirt"])

      expect((await post("/admin/search/synonyms", { terms: ["tek"] })).status).toBe(400)
      const same = await post("/admin/search/synonyms", { terms: ["kupa", "KUPA"] })
      expect([same.status, same.data.message]).toEqual([400, "search.synonym_terms_too_few"])
      const long = await post("/admin/search/synonyms", { terms: ["a b c d", "e"] })
      expect([long.status, long.data.message]).toEqual([400, "search.synonym_term_too_long"])
      expect((await post("/admin/search/synonyms", { terms: ["a", "b"], x: 1 })).status).toBe(400)

      expect((await get("/admin/search/synonyms")).data.count).toBe(1)
      expect((await get("/admin/search/synonyms?q=tisort")).data.count).toBe(1)
      expect((await get("/admin/search/synonyms?q=kupa")).data.count).toBe(0)
    })

    it("refuses a term search could never match with its key, never dropping it", async () => {
      for (const terms of [
        ["!!!", "kupa", "bardak"],
        ["!!!", "kupa"],
        ["   ", "kupa", "bardak"],
        ["ku\u0007pa", "bardak"],
        ["kupa\u0000", "bardak"],
        ["kupa\ud800", "bardak"],
      ]) {
        const refused = await post("/admin/search/synonyms", { terms })
        expect([refused.status, refused.data.message]).toEqual([400, "search.synonym_term_invalid"])
      }
      const made = await post("/admin/search/synonyms", { terms: ["kupa", "bardak"] })
      const id = made.data.synonym?.id ?? ""
      const changed = await post(`/admin/search/synonyms/${id}`, { terms: ["kupa", "bardak", "?"] })
      expect([changed.status, changed.data.message]).toEqual([400, "search.synonym_term_invalid"])
      expect(
        (await get("/admin/search/synonyms")).data.synonyms?.map((group) => group.terms)
      ).toEqual([["kupa", "bardak"]])
    })

    it("tells every role what the index holds; only the owner and admins write synonyms", async () => {
      const product = await kit.product({ title: "Durum Kupası" })
      const before = Date.now()
      await indexCatalogue(getContainer())
      expect((await post("/admin/search/synonyms", { terms: ["kupa", "bardak"] })).status).toBe(201)
      const status = await eventually(
        () => settle(http.get<IndexStatus>("/admin/search/index", { headers })),
        (answer) => answer.data.pending === 0
      )
      const rows = await index().documentIds("", 10_000)
      expect(rows).toContain(product)
      expect(status.status).toBe(200)
      expect(Object.keys(status.data).sort()).toEqual([
        "dictionary_words",
        "documents",
        "last_rebuilt_at",
        "pending",
        "synonyms",
      ])
      expect(status.data).toMatchObject({ documents: rows.length, pending: 0, synonyms: 1 })
      expect(status.data.dictionary_words).toBeGreaterThan(0)
      // The rebuild wrote every row again (the database's clock, a little leeway)
      expect(Date.parse(status.data.last_rebuilt_at ?? "")).toBeGreaterThan(before - 5_000)

      await index().markPending(["prod_waiting"])
      const [admin, operations, readonly] = await Promise.all(
        (["admin", "operations", "readonly"] as const).map((role) =>
          createAdminUser(http, getContainer(), role)
        )
      )
      for (const staff of [admin, operations, readonly]) {
        const read = await settle(
          http.get<IndexStatus>("/admin/search/index", { headers: staff?.headers ?? {} })
        )
        expect([read.status, read.data.pending]).toEqual([200, 1])
      }
      const write = (staff: typeof admin) =>
        settle(
          http.post<Answer>(
            "/admin/search/synonyms",
            { terms: ["çay", "demlik"] },
            { headers: staff?.headers ?? {} }
          )
        )
      expect((await write(operations)).status).toBe(403)
      expect((await write(readonly)).status).toBe(403)
      expect((await write(admin)).status).toBe(201)
    })

    it("finds a product by any term of a group, both ways, until the group changes", async () => {
      const shirt = await kit.product({ title: "Pamuklu T Shirt" })
      const tee = await kit.product({ title: "Basic Tişört" })
      const ids = [shirt, tee]
      expect(among((await kit.search("tişört")).data, ids)).toEqual([tee])

      const made = await post("/admin/search/synonyms", { terms: ["tişört", "t shirt"] })
      const id = made.data.synonym?.id ?? ""
      expect(among((await kit.search("tişört")).data, ids).sort()).toEqual([...ids].sort())
      expect(among((await kit.search("t shirt")).data, ids)).toContain(tee)
      // The word itself ranks over its synonym
      expect(among((await kit.search("tişört")).data, ids)[0]).toBe(tee)

      const changed = await post(`/admin/search/synonyms/${id}`, { terms: ["tişört", "tshirt"] })
      expect(changed.data.synonym?.terms).toEqual(["tişört", "tshirt"])
      expect(among((await kit.search("tişört")).data, ids)).toEqual([tee])

      expect((await remove(`/admin/search/synonyms/${id}`)).status).toBe(200)
      expect((await remove(`/admin/search/synonyms/${id}`)).status).toBe(404)
      expect((await post("/admin/search/synonyms/ssyn_yok", { terms: ["a", "b"] })).status).toBe(
        404
      )
      expect((await get("/admin/search/synonyms")).data.count).toBe(0)
    })
  },
})
