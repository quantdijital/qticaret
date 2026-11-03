import { MedusaError } from "@medusajs/framework/utils"
import { createStep, createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { SEARCH_INDEX_MODULE } from "../../src/modules/search-index"
import type SearchIndexModuleService from "../../src/modules/search-index/service"
import { readSearchDocuments } from "../../src/workflows/search/source"
import { writeSearchDocumentsStep } from "../../src/workflows/search/steps/write-search-documents"
import type { WriteSearchDocumentsInput } from "../../src/workflows/search/steps/write-search-documents"
import { createAdminUser } from "../helpers/admin"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { indexCatalogue } from "../helpers/search-index"
import { among, searchKit } from "../helpers/search"
import type { SearchKit } from "../helpers/search"

jest.setTimeout(180 * 1000)

// A write followed by a step that fails: the index must be as before
const failAfterWrite = createStep("test-search-index-fail", () => {
  throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "test.fail")
})
const writeThenFail = createWorkflow(
  "test-search-index-write-then-fail",
  (input: WriteSearchDocumentsInput) => {
    writeSearchDocumentsStep(input)
    failAfterWrite()
    return new WorkflowResponse(undefined)
  }
)

/**
 * adr/0056: the index follows the catalogue through events, after each
 * write answers: a product made, renamed, given a brand whose name
 * changes, and removed. A failed index write leaves the rows as they were.
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

    const post = <T>(url: string, body: unknown) => settle(http.post<T>(url, body, { headers }))
    const found = (q: string, id: string) =>
      eventually(
        async () => among((await kit.search(q, {}, { indexed: false })).data, [id]),
        (ids) => ids.length === 1
      )
    const gone = (q: string, id: string) =>
      eventually(
        async () => among((await kit.search(q, {}, { indexed: false })).data, [id]),
        (ids) => ids.length === 0
      )

    it("indexes a product made, renamed, branded and removed, after each write", async () => {
      const id = await kit.product({ title: "Zeytin Kasesi" })
      expect(await found("zeytin", id)).toEqual([id])

      await post(`/admin/products/${id}`, { title: "Ceviz Kasesi" })
      expect(await found("ceviz", id)).toEqual([id])
      expect(await gone("zeytin", id)).toEqual([])

      const brand = await post<{ brand: { id: string } }>("/admin/brands", { name: "Usta Atölye" })
      const brandId = brand.data.brand.id
      await post(`/admin/products/${id}/brand`, { brand_id: brandId })
      expect(await found("usta", id)).toEqual([id])
      await post(`/admin/brands/${brandId}`, { name: "Kuzey Atölye" })
      expect(await found("kuzey", id)).toEqual([id])
      expect(await gone("usta", id)).toEqual([])

      await settle(http.delete(`/admin/products/${id}`, { headers }))
      expect(await gone("ceviz", id)).toEqual([])
      expect(
        await eventually(
          () => index().readDocuments([id]),
          (rows) => rows.length === 0
        )
      ).toEqual([])
    })

    it("leaves the rows as they were when a later step fails", async () => {
      const id = await kit.product({ title: "Bakır Cezve" })
      await indexCatalogue(getContainer())
      const before = await index().readDocuments([id])
      const { documents } = await readSearchDocuments(getContainer(), [id])
      const renamed = documents.map((doc) => ({ ...doc, title: "baska" }))
      const fresh = renamed.map((doc) => ({ ...doc, product_id: "prod_test_yeni" }))

      const { errors } = await writeThenFail(getContainer()).run({
        input: { documents: [...renamed, ...fresh], gone: [] },
        throwOnError: false,
      })
      expect(errors.length).toBeGreaterThan(0)
      expect(await index().readDocuments([id, "prod_test_yeni"])).toEqual(before)
    })
  },
})
