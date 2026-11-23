import { DEFAULT_ROBOTS_TXT } from "../../modules/platform-settings/sections/seo"
import { isCrawlable, parseRobots } from "../../lib/seo/robots-match"
import { F3_17_DEFAULT } from "../seo-robots-exact-system-pages"
import { PREVIOUS_DEFAULT, updateRobotsDefault } from "../seo-robots-facet-lines"

function fakes(robots: string, version: number) {
  const saved: unknown[] = []
  const recorded: unknown[] = []
  const settings = {
    readSection: jest.fn(async () => Promise.resolve({ values: { robots_txt: robots }, version })),
    saveSection: jest.fn(async (_name: string, patch: unknown) => {
      saved.push(patch)
      return Promise.resolve({})
    }),
  }
  const audit = {
    record: jest.fn(async (entry: unknown) => {
      recorded.push(entry)
      return Promise.resolve({})
    }),
  }
  return { settings, audit, saved, recorded }
}

describe("robots default update (F3.17 migration script)", () => {
  it("replaces the old default a shop saved, and records it as the system's", async () => {
    const { settings, audit, saved, recorded } = fakes(
      `${PREVIOUS_DEFAULT.replace(/\n/g, "\r\n")}\n`,
      3
    )
    expect(await updateRobotsDefault(settings as never, audit as never)).toBe(true)
    expect(saved).toEqual([{ robots_txt: DEFAULT_ROBOTS_TXT }])
    expect(recorded).toEqual([
      expect.objectContaining({
        kind: "system",
        resource_type: "platform_settings",
        resource_id: "seo",
      }),
    ])
  })

  it.each([
    ["a shop that never saved (it reads the default)", PREVIOUS_DEFAULT, 0],
    ["a template of the shop's own", `${PREVIOUS_DEFAULT}\nDisallow: /ozel`, 2],
    ["the new default", DEFAULT_ROBOTS_TXT, 4],
  ])("leaves %s", async (_label, robots, version) => {
    const { settings, audit, saved, recorded } = fakes(robots, version)
    expect(await updateRobotsDefault(settings as never, audit as never)).toBe(false)
    expect([saved, recorded]).toEqual([[], []])
  })

  it("knew the old default as the code had it", () => {
    expect(PREVIOUS_DEFAULT).toBe(
      "User-agent: *\nDisallow: /sepet\nDisallow: /odeme\nDisallow: /hesap\nDisallow: /arama\nDisallow: /*?sort=\nDisallow: /*?page=0\n\nSitemap: {sitemap_url}"
    )
  })
})

describe("robots default with exact system pages (adr/0017 Ek 2026-11-23)", () => {
  it("replaces the F3.17 default a shop saved", async () => {
    const { settings, audit, saved, recorded } = fakes(F3_17_DEFAULT, 5)
    expect(await updateRobotsDefault(settings as never, audit as never, F3_17_DEFAULT)).toBe(true)
    expect(saved).toEqual([{ robots_txt: DEFAULT_ROBOTS_TXT }])
    expect(recorded).toEqual([
      expect.objectContaining({
        changes: { robots_txt: { before: F3_17_DEFAULT, after: DEFAULT_ROBOTS_TXT } },
      }),
    ])
  })

  it("leaves a template of the shop's own", async () => {
    const { settings, audit, saved } = fakes(`${F3_17_DEFAULT}\nDisallow: /ozel`, 5)
    expect(await updateRobotsDefault(settings as never, audit as never, F3_17_DEFAULT)).toBe(false)
    expect(saved).toEqual([])
  })

  it("knew the F3.17 default as the code had it", () => {
    expect(F3_17_DEFAULT).toBe(
      "User-agent: *\nDisallow: /sepet\nDisallow: /odeme\nDisallow: /hesap\nDisallow: /arama\n{facet_disallow}\n\nSitemap: {sitemap_url}"
    )
  })

  it("closes the system pages, not a category whose name starts so", () => {
    const groups = parseRobots(DEFAULT_ROBOTS_TXT)
    for (const path of ["/sepet", "/hesap/siparisler", "/arama?q=caki", "/odeme"]) {
      expect([path, isCrawlable(groups, "*", path)]).toEqual([path, false])
    }
    for (const path of ["/hesap-makineleri/bilimsel", "/sepetler", "/aramali-telsiz"]) {
      expect([path, isCrawlable(groups, "*", path)]).toEqual([path, true])
    }
  })
})
