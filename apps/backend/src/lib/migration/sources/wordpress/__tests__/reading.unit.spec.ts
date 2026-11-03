import { contentDoc } from "../../../../content/doc"
import { looksLikeWxr, wxrText } from "../file"
import { bodyBlocks, documentOf, hrefOf, plainText } from "../html"
import { unserialize } from "../php"
import { readWxr } from "../reader"
import { filled } from "../seo"
import { expandShortcodes } from "../shortcodes"
import { detectBase, oldPathOf } from "../urls"
import { serialize, wxrFixture } from "./wxr"

/** The key a refusal names, or null when there was none. */
const refusalOf = (work: () => unknown): string | null => {
  try {
    work()
  } catch (error) {
    return (error as { safeMessage?: string }).safeMessage ?? "thrown"
  }
  return null
}

const within = (ms: number, work: () => unknown) => {
  const started = performance.now()
  work()
  expect(performance.now() - started).toBeLessThan(ms)
}

describe("reading a WordPress export as untrusted data", () => {
  it("refuses what is no WordPress export, a DTD included", () => {
    expect(looksLikeWxr(Buffer.from(wxrFixture()))).toBe(true)
    expect(looksLikeWxr(Buffer.from("<rss><channel/></rss>"))).toBe(false)
    expect(
      refusalOf(() => readWxr('<rss xmlns:wp="http://wordpress.org/export/1.2/"><channel/></rss>'))
    ).toBe("migration.wordpress_invalid")
    const withEntity = wxrFixture().replace(
      "<rss",
      '<!DOCTYPE rss [<!ENTITY x SYSTEM "file:///etc/passwd">]><rss'
    )
    expect(refusalOf(() => readWxr(withEntity))).toBe("migration.wordpress_invalid")
  })

  it("takes HTML in CDATA as text: unclosed tags and a DOCTYPE there count for nothing", () => {
    const body = `<!DOCTYPE html>${"<img src=x><br>".repeat(500)}<p>son</p>`
    const text = wxrFixture().replace("<p>Biz bir <em>aile</em> işletmesiyiz.</p>", body)
    const page = readWxr(text).items.find((item) => item.id === "50")
    expect(page?.content).toBe(`<h1>Hakkımızda</h1>${body}`)
  })

  it("reads no e-mail or IP address of authors and commenters", () => {
    const read = JSON.stringify(readWxr(wxrFixture()))
    expect(read).not.toContain("ayse@example.com")
    expect(read).not.toContain("yazar@example.com")
    expect(read).not.toContain("192.0.2.7")
  })

  it("reads the export's text without its byte order mark", async () => {
    expect(await wxrText(Buffer.from(`\uFEFF${wxrFixture()}`))).toBe(wxrFixture())
  })
})

describe("PHP serialized meta, read as data", () => {
  it("reads strings by their bytes, numbers, booleans, arrays", () => {
    const value = unserialize(
      serialize({ ad: "Kırmızı | Yeşil", n: 3, d: 1.5, b: true, list: ["a"] })
    )
    expect(value).toEqual(
      new Map<string, unknown>([
        ["ad", "Kırmızı | Yeşil"],
        ["n", 3],
        ["d", 1.5],
        ["b", true],
        ["list", new Map([["0", "a"]])],
      ])
    )
  })

  it("reads a string whose byte count a search-and-replace spoilt, up to its closing quote", () => {
    expect(unserialize('a:1:{s:3:"url";s:5:"https://yeni.example.com/x";}')).toEqual(
      new Map([["url", "https://yeni.example.com/x"]])
    )
  })

  it("never makes an object or follows a reference, and caps size and depth", () => {
    expect(unserialize('O:8:"stdClass":0:{}')).toBeUndefined()
    expect(unserialize("a:1:{i:0;r:1;}")).toBeUndefined()
    expect(unserialize(`${"a:1:{i:0;".repeat(20)}N;${"}".repeat(20)}`)).toBeUndefined()
    expect(unserialize("a:99999999:{}")).toBeUndefined()
    expect(unserialize("nope")).toBeUndefined()
    within(1_000, () => unserialize(`a:1:{s:3:"x";s:9:"${'";'.repeat(200_000)}`))
  })
})

describe("a WordPress body as the content document", () => {
  it("keeps headings, lists, tables and marks; drops scripts, frames and pictures", () => {
    const { blocks, images, widgets } = bodyBlocks(
      `<h1>Başlık</h1><h2>Alt</h2><p>Bir <b>kalın</b> <i>eğik</i> &amp; <a href="javascript:alert(1)">kötü</a> metin.</p>
       <script>alert(1)</script><iframe src="https://x.example.com"><p>gizli</p></iframe>
       <ol start="3"><li>bir<ul><li>iç</li></ul></li><li>iki</li></ol>
       <blockquote><p>Alıntı</p></blockquote>
       <table><thead><tr><th>Ad</th><th>Değer</th></tr></thead><tbody><tr><td>Boy</td><td>21 cm</td></tr></tbody></table>
       <figure><img src="a.png"><figcaption>Görsel yazısı</figcaption></figure>[gallery ids="1,2"]`,
      { title: "Başlık" }
    )
    expect(images).toBe(1)
    expect(widgets).toBe(1)
    expect(blocks.map((block) => block.type)).toEqual([
      "heading",
      "paragraph",
      "orderedList",
      "blockquote",
      "table",
      "paragraph",
    ])
    expect(contentDoc.safeParse({ type: "doc", content: blocks }).success).toBe(true)
    expect(plainText(blocks, 10_000).text).toBe(
      "Alt\n\nBir kalın eğik & kötü metin.\n\n• bir\n\n– iç\n\n• iki\n\nAlıntı\n\nAd: Değer\n\nBoy: 21 cm\n\nGörsel yazısı"
    )
  })

  it("makes the old site's links paths here and drops unsafe ones", () => {
    expect(hrefOf("https://www.eski.example.com/urun/tava/?a=1", "eski.example.com")).toBe(
      "/urun/tava?a=1"
    )
    expect(hrefOf("/blog/yazi/#bas", null)).toBe("/blog/yazi#bas")
    expect(hrefOf("https://baska.example.com/x", "eski.example.com")).toBe(
      "https://baska.example.com/x"
    )
    expect(hrefOf("javascript:alert(1)", null)).toBeNull()
    expect(hrefOf("#bolum", null)).toBeNull()
  })

  it("cuts a body past the document's bounds at a block", () => {
    const long = "<p>" + "kelime ".repeat(3_000) + "</p>"
    const { doc, cut } = documentOf(bodyBlocks(long.repeat(20)).blocks)
    expect(cut).toBe(true)
    expect(contentDoc.safeParse(doc).success).toBe(true)
  })

  it("turns question shortcodes into headings and strips the rest, in linear time", () => {
    expect(
      expandShortcodes(
        '[accordion][accordion-item title="Kargo?"]<p>2 gün</p>[/accordion-item][/accordion] [Not] [1]'
      ).html
    ).toBe("<h3>Kargo?</h3><p>2 gün</p> [Not] [1]")
    expect(expandShortcodes("[embed]https://video.example.com/x[/embed]son").html).toBe("son")
    within(1_000, () => expandShortcodes("[a ".repeat(200_000)))
    within(1_000, () => bodyBlocks("<b><i><a href='x'>".repeat(30_000)))
    within(1_000, () => bodyBlocks("<ul><li>".repeat(30_000)))
  })
})

describe("old addresses and SEO fields", () => {
  const site = new URL("https://eski.example.com")

  it("takes an item's path on the old site only", () => {
    expect(oldPathOf("https://www.eski.example.com/urun/x/", site)).toBe("/urun/x/")
    expect(oldPathOf("https://eski.example.com/?p=12", site)).toBeNull()
    expect(oldPathOf("https://baska.example.com/x/", site)).toBeNull()
    expect(oldPathOf("https://eski.example.com/", site)).toBeNull()
  })

  it("reads an archive base from the links that reach it, else the default", () => {
    expect(
      detectBase(
        ["/urun-kategori/mutfak/tavalar", "/urun-kategori/mutfak"],
        ["mutfak", "mutfak/tavalar"],
        "/product-category/"
      )
    ).toBe("/urun-kategori/")
    expect(detectBase([], ["mutfak"], "/product-category/")).toBe("/product-category/")
  })

  it("fills the SEO plugins' variables it knows; a title of variables only is the shop's template's", () => {
    const values = { title: "Tava", site: "Örnek" }
    expect(filled("%title% %sep% %sitename%", values)).toBeNull()
    expect(filled("%%title%% %%sep%% %%sitename%%", values)).toBeNull()
    expect(filled("Tava Rehberi %sep% %sitename%", values)).toBe("Tava Rehberi - Örnek")
    expect(filled("Tava %customfield(x)%", values)).toBeNull()
    expect(filled("Tava %focuskw%", values)).toBeNull()
  })
})
