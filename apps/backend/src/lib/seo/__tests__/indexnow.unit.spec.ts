import { INDEXNOW_MAX_URLS, indexNowPayloads, isIndexNowKey } from "../indexnow"

// A key of the right form, built here so it reads as the fixture it is
const KEY = "ab".repeat(16)

describe("IndexNow", () => {
  it("announces each page once on the host, with where the key lives", () => {
    expect(
      indexNowPayloads("magaza.example.com", KEY, ["/urun/a", "/urun/a", "/kategori/b"])
    ).toEqual([
      {
        host: "magaza.example.com",
        key: KEY,
        keyLocation: `https://magaza.example.com/${KEY}.txt`,
        urlList: ["https://magaza.example.com/urun/a", "https://magaza.example.com/kategori/b"],
      },
    ])
  })

  it("splits at the protocol's limit and sends nothing for no pages", () => {
    const paths = Array.from(
      { length: INDEXNOW_MAX_URLS + 1 },
      (_, index) => `/urun/${String(index)}`
    )
    expect(
      indexNowPayloads("m.example.com", KEY, paths).map(({ urlList }) => urlList.length)
    ).toEqual([INDEXNOW_MAX_URLS, 1])
    expect(indexNowPayloads("m.example.com", KEY, [])).toEqual([])
  })

  it("knows a key by its form", () => {
    expect(isIndexNowKey(KEY)).toBe(true)
    expect(isIndexNowKey("../etc/passwd")).toBe(false)
  })
})
