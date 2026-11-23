// A spec importing a workflow (bulk edit, catalog) pulls these in before any module loads
import { writeBulkChange } from "../../catalog/bulk-edit/write"
import { setProductAddonTemplatesWorkflow } from "../index"

describe("add-on template workflows", () => {
  it("load outside the app without evaluating a link definition", () => {
    expect(setProductAddonTemplatesWorkflow).toBeDefined()
    expect(writeBulkChange).toBeDefined()
  })
})
