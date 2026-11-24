import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { HERO_VIDEO_LIMITS } from "@qticaret/types"
import "@/lib/i18n"
import type { AnySection, HeroSection } from "@/features/storefront/api/layout"
import { sectionProblems } from "@/features/storefront/layout/problems"
import { newHomeSection } from "@/features/storefront/layout/sections"
import { switchVariant } from "@/features/storefront/layout/variants"
import en from "@/locales/en.json"
import tr from "@/locales/tr.json"
import { SectionPanel } from "../section-panel"
import { openGroup } from "../settings-groups.fixtures"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))
vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: vi.fn() }, admin: {} } }))

type Full = Extract<HeroSection, { variant: "full_image" }>

const hero = () => newHomeSection("hero", "kapak00001") as HeroSection
const full = (over: Partial<Full> = {}): Full => ({
  ...(switchVariant(hero(), "full_image") as Full),
  ...over,
})

/** The section's panel with its problems as the editor finds them: every change kept. */
function renderPanel(section: AnySection) {
  const changes: AnySection[] = []
  function Holder() {
    const [value, setValue] = useState(section)
    return (
      <SectionPanel
        section={value}
        group="home"
        problems={sectionProblems(value)}
        canDuplicate
        onChange={(next) => {
          changes.push(next)
          setValue(next)
        }}
        onPlace={vi.fn()}
        onBack={vi.fn()}
        onDuplicate={vi.fn()}
        onRemove={vi.fn()}
        badges={[]}
        onBadges={vi.fn()}
      />
    )
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <Holder />
    </QueryClientProvider>
  )
  return changes
}

const videoGroup = () => document.querySelector('[data-panel-group="video"]')

describe("the full image opening's video button in the panel", () => {
  it("names the group and its fields in both languages", () => {
    for (const words of [tr, en]) {
      const own = words.storefront.editor.heroFull.video
      for (const field of [own.url, own.label]) {
        for (const key of ["label", "term", "placeholder", "hint"]) {
          expect(field).toHaveProperty(key)
        }
      }
      expect(words.storefront.editor.panel.groups.video).toBe("Video")
      expect(words.storefront.editor.problems.videoInvalid).toMatch(/YouTube.*Vimeo/)
    }
  })

  it("shows its group on the full image only", () => {
    renderPanel(hero())
    expect(videoGroup()).toBeNull()
  })

  it("takes a video's link and the button's words, both empty at first", async () => {
    const user = userEvent.setup()
    const changes = renderPanel(full())
    await openGroup(user, "Video")

    const link = screen.getByRole("textbox", { name: /Video adresi/ })
    const words = screen.getByRole("textbox", { name: /Düğme yazısı/ })
    expect(link).toHaveValue("")
    expect(words).toHaveValue("")

    await user.click(link)
    await user.paste("https://youtu.be/dQw4w9WgXcQ")
    expect(changes.at(-1)).toMatchObject({ video_url: "https://youtu.be/dQw4w9WgXcQ" })
    expect(screen.queryByText(/Bir YouTube ya da Vimeo video bağlantısı yapıştırın/)).toBeNull()

    await user.click(words)
    await user.paste("Tanıtım")
    expect(changes.at(-1)).toMatchObject({
      video_url: "https://youtu.be/dQw4w9WgXcQ",
      video_label: "Tanıtım",
    })
  })

  it("names a link the storefront would not play under its field", async () => {
    const user = userEvent.setup()
    renderPanel(full({ video_url: "https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ" }))
    await openGroup(user, "Video")

    expect(screen.getByText(/Bir YouTube ya da Vimeo video bağlantısı yapıştırın/)).toBeVisible()
    expect(screen.getByRole("textbox", { name: /Video adresi/ })).toHaveAttribute(
      "aria-invalid",
      "true"
    )
  })

  it("finds the problems before the save", () => {
    const problems = (over: Partial<Full>) => sectionProblems(full(over))

    expect(problems({})["video_url"]).toBeUndefined()
    expect(problems({ video_url: "https://vimeo.com/76979871" })["video_url"]).toBeUndefined()
    expect(problems({ video_url: "javascript:alert(1)" })["video_url"]).toBe("videoInvalid")
    expect(problems({ video_url: "https://example.com/v.mp4" })["video_url"]).toBe("videoInvalid")
    expect(problems({ video_label: "a".repeat(HERO_VIDEO_LIMITS.label + 1) })["video_label"]).toBe(
      "tooLong"
    )
  })
})
