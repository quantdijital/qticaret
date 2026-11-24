import { storedSettings } from "../layout-settings"
import { layoutTheme, withoutNoAccent } from "../layout-theme"
import { themeSection } from "../../../modules/platform-settings/sections/theme"

const { defaults } = themeSection
const theme = (typography: Record<string, unknown> = {}) => ({
  ...defaults,
  typography: { ...defaults.typography, ...typography },
})

describe("the design's accent face none (typography.accent)", () => {
  it("is read as left out: a design from before the face and one saying none are the same", () => {
    const before = layoutTheme.parse(theme())
    const none = layoutTheme.parse(theme({ accent: "none" }))
    expect(none?.typography).not.toHaveProperty("accent")
    // As the editor tells a change (`draftChanged`): by their text
    expect(JSON.stringify(none)).toBe(JSON.stringify(before))
  })

  it("is the same in a stored design: a draft saying none is what is live without it", () => {
    const draft = storedSettings({ settings: { theme: theme({ accent: "none" }) } })
    const live = storedSettings({ settings: { theme: theme() } })
    expect(draft.theme).not.toBeNull()
    expect(JSON.stringify(draft)).toBe(JSON.stringify(live))
  })

  it("keeps a chosen face, and refuses one off the list as before", () => {
    expect(layoutTheme.parse(theme({ accent: "caveat" }))?.typography.accent).toBe("caveat")
    expect(layoutTheme.safeParse(theme({ accent: "comic-sans" })).success).toBe(false)
    expect(layoutTheme.safeParse(theme({ accent: null })).success).toBe(false)
  })

  it("gives what is not a theme as it is, for the schema to refuse", () => {
    expect(withoutNoAccent(null)).toBeNull()
    expect(withoutNoAccent("none")).toBe("none")
    const odd = { typography: "none" }
    expect(withoutNoAccent(odd)).toBe(odd)
    const chosen = theme({ accent: "kalam" })
    expect(withoutNoAccent(chosen)).toBe(chosen)
  })
})
