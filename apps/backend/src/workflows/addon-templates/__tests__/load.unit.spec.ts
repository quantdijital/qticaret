describe("add-on template workflows", () => {
  it("load outside the app without evaluating a link definition", async () => {
    // A spec importing a workflow (bulk edit, catalog) pulls these in before any module loads
    const workflows = await import("..")
    const write = await import("../../catalog/bulk-edit/write")
    expect(workflows.setProductAddonTemplatesWorkflow).toBeDefined()
    expect(write.writeBulkChange).toBeDefined()
  })
})
