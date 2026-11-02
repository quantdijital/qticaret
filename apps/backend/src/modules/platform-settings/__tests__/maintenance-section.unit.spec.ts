import { maintenanceSection } from "../sections/maintenance"
import { mergePatch } from "../sections/define"

const { full, patch, defaults } = maintenanceSection

const saved = (body: Record<string, unknown>) => full.safeParse(mergePatch(defaults, body))
const issueOf = (body: Record<string, unknown>) => saved(body).error?.issues[0]?.message

describe("maintenance section", () => {
  it("starts off, and its defaults pass its own checks", () => {
    expect(defaults).toEqual({
      enabled: false,
      title: null,
      message: null,
      expected_at: null,
      allow_paths: [],
    })
    expect(full.safeParse(defaults).success).toBe(true)
  })

  it("takes a heading, a line with the shop's details and when it is back", () => {
    const parsed = full.parse(
      mergePatch(defaults, {
        enabled: true,
        title: "  Yakında açılıyoruz ",
        message: "Sorularınız için {telefon} numarasından bize ulaşın.",
        expected_at: "2026-11-10T09:00:00+03:00",
      })
    )

    expect(parsed.title).toBe("Yakında açılıyoruz")
    expect(parsed.message).toContain("{telefon}")
    expect(parsed.expected_at).toBe("2026-11-10T09:00:00+03:00")
  })

  it("keeps the heading and the line within their lengths", () => {
    expect(saved({ title: "a".repeat(80) }).success).toBe(true)
    expect(saved({ title: "a".repeat(81) }).success).toBe(false)
    expect(saved({ message: "a".repeat(600) }).success).toBe(true)
    expect(saved({ message: "a".repeat(601) }).success).toBe(false)
    expect(saved({ title: "" }).success).toBe(false)
    expect(issueOf({ title: "Bakım\u0000" })).toBe("platform_settings.text_invalid")
  })

  it("refuses a detail the shop does not have (a misspelt token)", () => {
    expect(issueOf({ message: "Bize {telefonu} ile ulaşın" })).toBe(
      "platform_settings.token_unknown"
    )
  })

  it("takes a date with its offset only", () => {
    expect(saved({ expected_at: "2026-11-10T06:00:00Z" }).success).toBe(true)
    for (const bad of ["2026-11-10", "yarın", "2026-13-40T00:00:00Z"]) {
      expect(issueOf({ expected_at: bad })).toBe("platform_settings.date_invalid")
    }
  })

  it("keeps open paths of this shop, tidied, each once", () => {
    const parsed = full.parse(
      mergePatch(defaults, {
        allow_paths: [" /Iletisim ", "/blog/", "/sozlesmeler/*", "/", "/iletisim"],
      })
    )

    expect(parsed.allow_paths).toEqual(["/iletisim", "/blog", "/sozlesmeler/*", "/"])
  })

  it.each([
    ["everything", "/*"],
    ["another host", "//evil.example"],
    ["an address", "https://ornek.com/x"],
    ["no leading slash", "iletisim"],
    ["a query", "/arama?q=x"],
    ["a fragment", "/sss#kargo"],
    ["a star inside", "/blog*/x"],
    ["a backslash", "/\\evil"],
    ["whitespace", "/iade ve degisim"],
    ["a step up", "/blog/../hesap"],
  ])("refuses %s as an open path", (_, path) => {
    expect(issueOf({ allow_paths: [path] })).toBe("platform_settings.url_invalid")
  })

  it("keeps at most twenty open paths", () => {
    const paths = Array.from({ length: 21 }, (_, i) => `/sayfa-${String(i)}`)
    expect(saved({ allow_paths: paths.slice(0, 20) }).success).toBe(true)
    expect(saved({ allow_paths: paths }).success).toBe(false)
  })

  it("takes any subset of fields from the panel, and nothing unknown", () => {
    expect(patch.safeParse({ enabled: true }).success).toBe(true)
    expect(patch.safeParse({ enabled: true, bypass: "x" }).success).toBe(false)
  })
})
