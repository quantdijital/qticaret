import { render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { useDocumentTitle, useDocumentTitleName } from "./use-document-title"

function Page({ title }: { title: string | undefined }) {
  useDocumentTitle(title)
  return null
}

function Named({ name, title }: { name: string | undefined; title: string | undefined }) {
  useDocumentTitleName(name)
  return <Page title={title} />
}

describe("useDocumentTitle", () => {
  afterEach(() => {
    document.title = ""
  })

  it("puts the page's title before the panel's name, and takes it back on leaving", () => {
    const view = render(<Named name="My L'arte" title="Siparişler" />)
    expect(document.title).toBe("Siparişler · My L'arte")
    view.rerender(<Named name="My L'arte" title="Ürünler" />)
    expect(document.title).toBe("Ürünler · My L'arte")
    view.rerender(<Named name="My L'arte" title={undefined} />)
    expect(document.title).toBe("My L'arte")
  })

  it("leaves the next page's title alone when the last one goes", () => {
    const view = render(<Named name="Üst panel" title="Mağazalar" />)
    view.rerender(
      <>
        <Named name="Üst panel" title="Personel" />
      </>
    )
    view.unmount()
    render(<Named name="Üst panel" title="Paketler" />)
    expect(document.title).toBe("Paketler · Üst panel")
  })

  it("ignores a blank title", () => {
    render(<Named name="Panel" title="  " />)
    expect(document.title).toBe("Panel")
  })
})
