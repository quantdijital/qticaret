import { contentDoc } from "../../../../content/doc"
import { wordpressRecords } from ".."
import { largestOf, onSite } from "../body-images"
import { bodyBlocks } from "../html"
import { wxrFixture } from "./wxr"

const SITE = "https://eski.example.com"
const upload = (name: string) => `${SITE}/wp-content/uploads/2026/01/${name}`
const POST_PICTURE = /<figure><img [^>]*><\/figure>/

/** The fixture's post (post:40) with this body in place of its one picture. */
function postWith(html: string, library: (wxr: string) => string = (wxr) => wxr) {
  const wxr = wxrFixture(SITE)
  expect(wxr).toMatch(POST_PICTURE)
  const records = wordpressRecords(library(wxr.replace(POST_PICTURE, html)))
  const post = records.posts.find((each) => each.source_key === "post:40")
  const pictures = (post?.content.body.content ?? []).flatMap((block) =>
    block.type === "image" ? [block.attrs] : []
  )
  const lost = records.notes
    .filter((note) => note.key === "migration.wordpress_body_media")
    .map((note) => note.source_key)
  return { post, pictures, lost }
}

describe("a WordPress post's pictures (adr/0042 Ek 2026-11-27)", () => {
  it("keeps the featured image as the post's cover", () => {
    const { post } = postWith("")
    expect(post?.content.cover).toEqual({
      url: upload("kapak.png"),
      alt: "Tava bakımı kapak",
    })
  })

  it("keeps an inline picture where it stands, with its alt text", () => {
    const { post, pictures, lost } = postWith(
      `<p>Önce <img src="${upload("x.png")}" alt="Yağlanmış tava"> sonra.</p>`
    )
    expect(pictures).toEqual([{ src: upload("x.png"), alt: "Yağlanmış tava" }])
    expect(post?.content.body.content.map((block) => block.type)).toEqual([
      "paragraph",
      "paragraph",
      "image",
      "paragraph",
      "heading",
      "paragraph",
    ])
    expect(lost).toEqual([])
    expect(contentDoc.safeParse(post?.content.body).success).toBe(true)
  })

  it("reads a block editor image by its upload, the original file rather than the size shown", () => {
    const { pictures } = postWith(
      `<!-- wp:image {"id":101,"sizeSlug":"medium"} --><figure class="wp-block-image size-medium"><img src="${upload("tava-300x300.png")}" alt="" class="wp-image-101" srcset="${upload("tava-300x300.png")} 300w, ${upload("tava-1024x1024.png")} 1024w"/></figure><!-- /wp:image -->`
    )
    // The library's alt where the tag has none
    expect(pictures).toEqual([{ src: upload("tava.png"), alt: "Döküm tava önden" }])
  })

  it("maps a resized or scaled file to its original upload, by its name alone", () => {
    const { pictures } = postWith(
      `<p><img src="${upload("tava-yan-768x512.png")}" alt="Yan"></p><p><img src="${upload("tava-yan-scaled.png")}"></p>`
    )
    expect(pictures).toEqual([
      { src: upload("tava-yan.png"), alt: "Yan" },
      { src: upload("tava-yan.png") },
    ])
  })

  it("takes the largest file of a srcset, a lazy loader's address, a CDN's copy of the site's file", () => {
    const { pictures } = postWith(
      [
        `<img src="${upload("a-300x200.jpg")}" srcset="${upload("a-300x200.jpg")} 300w, ${upload("a-1200x800.jpg")} 1200w, ${upload("a-768x512.jpg")} 768w">`,
        `<img src="data:image/gif;base64,R0lGOD" data-src="/wp-content/uploads/2026/01/b.jpg" alt="B">`,
        `<img src="https://i1.wp.com/eski.example.com/wp-content/uploads/2026/01/c.jpg?resize=300%2C200&ssl=1">`,
      ].join("")
    )
    expect(pictures).toEqual([
      { src: upload("a-1200x800.jpg") },
      { src: upload("b.jpg"), alt: "B" },
      { src: upload("c.jpg") },
    ])
  })

  it("leaves out a picture from another host and names it; the text moves", () => {
    const { pictures, lost, post } = postWith(
      `<p><img src="https://cdn.baska.example.net/foto.jpg" alt="Başka"><img src="https://i0.wp.com/baska.example.net/x.jpg"></p>`
    )
    expect(pictures).toEqual([])
    expect(lost).toEqual(["post:40"])
    expect(post?.content.body.content.map((block) => block.type)).toEqual([
      "paragraph",
      "heading",
      "paragraph",
    ])
  })

  it("makes a gallery's uploads pictures; one inside a list stays out and is named", () => {
    const { pictures, lost } = postWith(
      `[gallery ids="101,102,9999"]<ul><li><img src="${upload("liste.png")}"> madde</li></ul>`
    )
    expect(pictures.map((picture) => picture.src)).toEqual([
      upload("tava.png"),
      upload("tava-yan.png"),
    ])
    // The gallery's missing upload and the list's picture
    expect(lost).toEqual(["post:40"])
  })

  it("leaves out a tag past its bounds, at once: a long run of letters, an overlong address", () => {
    const started = Date.now()
    const { pictures, lost } = postWith(
      `<img ${"a".repeat(200_000)}><img src="${upload(`${"u".repeat(1_100)}.png`)}">`
    )
    expect(pictures).toEqual([])
    expect(lost).toEqual(["post:40"])
    expect(Date.now() - started).toBeLessThan(2_000)
  })

  it("takes the library's file only on the site's own host, else the tag's own address", () => {
    const elsewhere = (wxr: string) =>
      wxr.replace(
        `<wp:attachment_url><![CDATA[${upload("tava.png")}]]>`,
        "<wp:attachment_url><![CDATA[https://cdn.baska.example.net/tava.png]]>"
      )
    const { pictures } = postWith(
      `<p><img class="wp-image-101" src="${upload("tava-300x300.png")}"></p><p><img class="wp-image-101"></p>`,
      elsewhere
    )
    // The tag's own file on the site; the one naming only the upload has none to fall back to
    expect(pictures).toEqual([{ src: upload("tava-300x300.png") }])
  })

  it("writes the library's address as a parsed URL: a space cannot break the text", () => {
    const spaced = (wxr: string) =>
      wxr.replace(
        `<wp:attachment_url><![CDATA[${upload("tava.png")}]]>`,
        `<wp:attachment_url><![CDATA[${upload("döküm tava.png")}]]>`
      )
    const { pictures, post } = postWith(`<p><img class="wp-image-101"></p>`, spaced)
    expect(pictures).toEqual([
      { src: upload("d%C3%B6k%C3%BCm%20tava.png"), alt: "Döküm tava önden" },
    ])
    expect(post?.content.body.content.map((block) => block.type)).toContain("heading")
  })

  it("reads a picture element by its img", () => {
    const { pictures } = postWith(
      `<picture><source type="image/webp" srcset="${upload("d.jpg.webp")}"><img src="${upload("d.jpg")}" alt="D"></picture>`
    )
    expect(pictures).toEqual([{ src: upload("d.jpg"), alt: "D" }])
  })

  it("keeps a product's description without pictures, as before", () => {
    const body = bodyBlocks(`<p>Metin</p><img src="${upload("x.png")}">`, {
      siteHost: "eski.example.com",
    })
    expect(body.images).toBe(1)
    expect(body.blocks.map((block) => block.type)).toEqual(["paragraph"])
  })
})

describe("reading a picture's address", () => {
  it("takes the widest candidate of a srcset", () => {
    expect(largestOf("a.jpg 300w, b.jpg 1024w, c.jpg 768w")).toBe("b.jpg")
    expect(largestOf("a.jpg 1x, b.jpg 2x")).toBe("b.jpg")
    expect(largestOf("")).toBeUndefined()
  })

  it("accepts the site's own files only, credentials and other schemes refused", () => {
    const site = new URL(SITE)
    expect(onSite("/wp-content/uploads/x.jpg?v=2", site)?.href).toBe(
      `${SITE}/wp-content/uploads/x.jpg`
    )
    expect(onSite("https://www.eski.example.com/x.jpg", site)?.hostname).toBe(
      "www.eski.example.com"
    )
    expect(onSite("//eski.example.com/x.jpg", site)?.href).toBe(`${SITE}/x.jpg`)
    expect(onSite("https://user:pw@eski.example.com/x.jpg", site)).toBeNull()
    expect(onSite("javascript:alert(1)", site)).toBeNull()
    expect(onSite("http://169.254.169.254/latest", site)).toBeNull()
    expect(onSite("https://eski.example.com.evil.example/x.jpg", site)).toBeNull()
    expect(onSite("/x.jpg", null)).toBeNull()
  })
})
