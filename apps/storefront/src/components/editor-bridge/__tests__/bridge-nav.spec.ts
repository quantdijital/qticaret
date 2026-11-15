// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import {
  formAddress,
  holdAddress,
  isPlainClick,
  isPreviewable,
  linkAddress,
  previewBase,
  shownPage,
} from "../bridge-nav"

/**
 * Links and searches stay in the preview (adr/0065 §6, Faz 2; security
 * review): only the shop's own pages are asked for, never another host, a
 * `javascript:` address, a preview's own address or an escaped path.
 */

const HERE = { href: "https://shop.example/onizleme/sfs_abc.x.y?sayfa=%2Furun%2Fa" }

describe("holding an address in the preview frame", () => {
  it("asks for a page of the shop, its query kept and its fragment dropped", () => {
    expect(holdAddress("/urun/sef-bicagi?renk=siyah#yorum", HERE)).toEqual({
      kind: "ask",
      path: "/urun/sef-bicagi?renk=siyah",
      previewable: true,
    })
    expect(holdAddress("https://shop.example/kategori/mutfak", HERE)).toMatchObject({
      kind: "ask",
      path: "/kategori/mutfak",
    })
  })

  it("asks for the cart and the search as previewable, checkout and account as not", () => {
    expect(holdAddress("/sepet", HERE)).toMatchObject({ previewable: true })
    expect(holdAddress("/arama?q=b", HERE)).toMatchObject({ previewable: true })
    for (const path of ["/odeme", "/hesap/siparisler", "/giris", "/api/search/suggest"]) {
      expect(holdAddress(path, HERE)).toMatchObject({ kind: "ask", previewable: false })
    }
  })

  it("drops another host, an odd scheme, a preview's own address and an escaped path", () => {
    for (const raw of [
      "https://evil.example/x",
      "//evil.example/x",
      "javascript:alert(1)",
      "JaVaScRiPt:alert(1)",
      "data:text/html,<b>x</b>",
      "/onizleme/sfs_other.x.y",
      "/%2F%2Fevil.example",
      "/a%5Cb",
      "/a%00b",
    ]) {
      expect(holdAddress(raw, HERE)).toEqual({ kind: "drop" })
    }
  })

  it("lets the browser keep a jump on the page shown, a mail and a phone link", () => {
    expect(holdAddress("#yorumlar", HERE)).toEqual({ kind: "pass" })
    expect(holdAddress("mailto:a@b.example", HERE)).toEqual({ kind: "pass" })
    expect(holdAddress("tel:+905551112233", HERE)).toEqual({ kind: "pass" })
  })
})

describe("the preview's addresses", () => {
  it("finds the preview's own address and the page it shows", () => {
    expect(previewBase("/onizleme/sfs_abc.x.y")).toBe("/onizleme/sfs_abc.x.y")
    expect(previewBase("/sepet")).toBeNull()
    expect(shownPage("?sayfa=%2Furun%2Fa")).toBe("/urun/a")
    expect(shownPage("")).toBe("/")
    expect(shownPage("?sayfa=%2F%2Fevil.example")).toBe("/")
  })

  it("previews a record's page, a list, the cart and the search only", () => {
    expect(isPreviewable("/urun/a")).toBe(true)
    expect(isPreviewable("/magaza")).toBe(true)
    expect(isPreviewable("/sepet/")).toBe(true)
    expect(isPreviewable("/odeme/sonuc")).toBe(false)
    expect(isPreviewable("/onizleme/x")).toBe(false)
  })
})

describe("which clicks and forms are held", () => {
  const plain = {
    button: 0,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    defaultPrevented: false,
  }

  it("holds a plain left click only: a modifier opens a tab of the browser's", () => {
    expect(isPlainClick(plain)).toBe(true)
    expect(isPlainClick({ ...plain, metaKey: true })).toBe(false)
    expect(isPlainClick({ ...plain, button: 1 })).toBe(false)
    expect(isPlainClick({ ...plain, defaultPrevented: true })).toBe(false)
  })

  it("leaves a link opening elsewhere or downloading to the browser", () => {
    const anchor = document.createElement("a")
    anchor.setAttribute("href", "/urun/a")
    expect(linkAddress(anchor)).toBe("/urun/a")
    anchor.setAttribute("target", "_blank")
    expect(linkAddress(anchor)).toBeNull()
    anchor.removeAttribute("target")
    anchor.setAttribute("download", "")
    expect(linkAddress(anchor)).toBeNull()
  })

  it("reads a search form's address; a POST or a function action is React's", () => {
    const form = document.createElement("form")
    form.setAttribute("action", "/arama?eski=1")
    const field = document.createElement("input")
    field.name = "q"
    field.value = "şef"
    form.append(field)
    expect(formAddress(form, null)).toBe("/arama?q=%C5%9Fef")
    form.setAttribute("method", "post")
    expect(formAddress(form, null)).toBeNull()
    form.setAttribute("method", "get")
    form.setAttribute("action", "javascript:throw new Error('React form')")
    expect(formAddress(form, null)).toBeNull()
  })
})
