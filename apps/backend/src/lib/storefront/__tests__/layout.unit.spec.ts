import { isShowing, layoutDocument } from "../layout"

const ALWAYS = { visible: true, starts_at: null, ends_at: null }
const help = (id: string, more: Record<string, unknown> = {}) => ({
  id,
  type: "help",
  ...ALWAYS,
  title: null,
  text: null,
  ...more,
})

describe("storefront layout document (adr/0049)", () => {
  it("fills what a section leaves out and keeps the groups apart", () => {
    const doc = layoutDocument.parse({ home: [{ id: "yazilar1", type: "posts" }] })
    expect(doc).toEqual({
      header: [],
      home: [{ id: "yazilar1", type: "posts", ...ALWAYS, title: null, limit: 3 }],
      footer: [],
    })
  })

  it.each([
    ["an id used twice", { home: [help("ayniid1"), help("ayniid1")] }],
    [
      "two announcement bars",
      {
        header: [
          { id: "duyuru1", type: "announcement_bar", lines: ["a"] },
          { id: "duyuru2", type: "announcement_bar", lines: ["b"] },
        ],
      },
    ],
    [
      "an end before the start",
      {
        home: [
          help("kampanya1", { starts_at: "2026-02-01T00:00:00Z", ends_at: "2026-01-01T00:00:00Z" }),
        ],
      },
    ],
    [
      "an image from another host's protocol-relative address",
      {
        home: [{ id: "giris01", type: "hero", image: { url: "//evil.example/x.png", alt: null } }],
      },
    ],
    [
      "a script link",
      {
        home: [
          {
            id: "giris01",
            type: "hero",
            links: [{ kind: "url", url: "javascript:alert(1)", label: "x" }],
          },
        ],
      },
    ],
    ["an unknown shop detail", { home: [help("yardim1", { text: "{telfon}" })] }],
    ["a section type it does not know", { home: [{ id: "garip01", type: "html", html: "<b>" }] }],
  ])("refuses %s", (_, doc) => {
    expect(layoutDocument.safeParse(doc).success).toBe(false)
  })

  it("shows a section while it is visible and within its dates", () => {
    const now = new Date("2026-11-02T12:00:00Z")
    expect(isShowing(ALWAYS, now)).toBe(true)
    expect(isShowing({ ...ALWAYS, visible: false }, now)).toBe(false)
    expect(isShowing({ ...ALWAYS, starts_at: "2026-11-03T00:00:00Z" }, now)).toBe(false)
    expect(isShowing({ ...ALWAYS, ends_at: "2026-11-02T12:00:00Z" }, now)).toBe(false)
    expect(
      isShowing(
        { visible: true, starts_at: "2026-11-01T00:00:00Z", ends_at: "2026-11-30T00:00:00Z" },
        now
      )
    ).toBe(true)
  })
})
