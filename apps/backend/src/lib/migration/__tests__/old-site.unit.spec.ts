import { gzipSync } from "node:zlib"
import yazl from "yazl"
import { onSite, searchConsolePages, sitemapEntries, sitemapText } from "../old-site"

const zipOf = (files: Record<string, string>): Promise<Buffer> => {
  const zip = new yazl.ZipFile()
  for (const [name, text] of Object.entries(files)) {
    zip.addBuffer(Buffer.from(text, "utf8"), name)
  }
  zip.end()
  const chunks: Buffer[] = []
  return new Promise((resolve, reject) => {
    zip.outputStream.on("data", (chunk: Buffer) => chunks.push(chunk))
    zip.outputStream.on("end", () => {
      resolve(Buffer.concat(chunks))
    })
    zip.outputStream.on("error", reject)
  })
}

const SITEMAP = `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc> https://eski.example.com/urun/tava </loc></url><url><loc>https://eski.example.com/hakkimizda</loc></url>
</urlset>`

describe("the old site's own address lists (F14.7)", () => {
  it("reads a sitemap, gzipped or not, and an index of sitemaps", () => {
    expect(sitemapEntries(sitemapText(gzipSync(SITEMAP)))).toEqual({
      index: false,
      locs: ["https://eski.example.com/urun/tava", "https://eski.example.com/hakkimizda"],
    })
    expect(
      sitemapEntries(
        "<sitemapindex><sitemap><loc>https://eski.example.com/s1.xml</loc></sitemap></sitemapindex>"
      )
    ).toEqual({ index: true, locs: ["https://eski.example.com/s1.xml"] })
  })

  it("refuses a sitemap that is none, or one defining entities", () => {
    expect(() => sitemapEntries("<html><body>404</body></html>")).toThrow()
    expect(() =>
      sitemapEntries('<!DOCTYPE x [<!ENTITY a "aaaa">]><urlset><url><loc>&a;</loc></url></urlset>')
    ).toThrow()
    expect(() => sitemapText(Buffer.from([0x1f, 0x8b, 0, 1, 2]))).toThrow()
  })

  it("keeps the old site's own addresses, with or without www", () => {
    const site = new URL("https://www.eski.example.com/sitemap.xml")
    expect(onSite("https://eski.example.com/urun/tava", site)).toBe(true)
    expect(onSite("http://WWW.eski.example.com/a", site)).toBe(true)
    expect(onSite("https://baska.example.com/a", site)).toBe(false)
    expect(onSite("javascript:alert(1)", site)).toBe(false)
  })

  it("reads Search Console's top pages in Turkish or English, alone or in the export's zip", async () => {
    const turkish =
      "﻿En çok tıklanan sayfalar,Tıklamalar,Gösterimler,TO,Konum\n" +
      "https://eski.example.com/urun/tava,1.234,9000,%13,4.2\n" +
      "https://eski.example.com/hakkimizda,12,300,%4,9\n"
    expect(await searchConsolePages(Buffer.from(turkish, "utf8"))).toEqual([
      { url: "https://eski.example.com/urun/tava", clicks: 1234 },
      { url: "https://eski.example.com/hakkimizda", clicks: 12 },
    ])
    const zip = await zipOf({
      "Queries.csv": "Top queries,Clicks\ntava,10\n",
      "Pages.csv":
        "Top pages,Clicks,Impressions,CTR,Position\nhttps://eski.example.com/a,7,70,10%,3\n",
    })
    expect(await searchConsolePages(zip)).toEqual([
      { url: "https://eski.example.com/a", clicks: 7 },
    ])
    await expect(
      searchConsolePages(await zipOf({ "Queries.csv": "Top queries,Clicks\n" }))
    ).rejects.toThrow()
    await expect(searchConsolePages(Buffer.from("a,b\n1,2\n"))).rejects.toThrow()
  })
})
