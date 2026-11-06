import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { GoogleRatingSection } from "@/features/storefront/api/layout"
import { sectionProblems } from "@/features/storefront/layout/problems"
import { HOME_TYPES, newHomeSection } from "@/features/storefront/layout/sections"
import { GoogleRatingForm } from "./google-rating-form"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))

/** The form as the editor holds it: every change kept, its problems found again. */
function renderForm(
  section = newHomeSection("google_rating", "googlepuan") as GoogleRatingSection
) {
  const changes: GoogleRatingSection[] = []
  function Holder() {
    const [value, setValue] = useState(section)
    return (
      <GoogleRatingForm
        section={value}
        problems={sectionProblems(value)}
        onChange={(next) => {
          changes.push(next)
          setValue(next)
        }}
      />
    )
  }
  render(<Holder />)
  return changes
}

/** adr/0058 Ek 2026-11-06: the home page's Google rating badge in the theme editor. */
describe("GoogleRatingForm", () => {
  it("is offered on the home page, new with no excerpts and the link to Google on", () => {
    expect(HOME_TYPES).toContain("google_rating")
    expect(newHomeSection("google_rating", "googlepuan")).toMatchObject({
      type: "google_rating",
      title: null,
      excerpts: 0,
      profile_link: true,
    })
  })

  it("turns excerpts on at two, counts them 1 to 3, and turns the Google link off", async () => {
    const changes = renderForm()

    expect(screen.queryByLabelText("Alıntı sayısı")).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("switch", { name: /Son yorumlardan alıntı göster/ }))
    expect(changes.at(-1)).toMatchObject({ excerpts: 2 })

    const count = screen.getByLabelText("Alıntı sayısı")
    await userEvent.clear(count)
    await userEvent.type(count, "9")
    expect(changes.at(-1)).toMatchObject({ excerpts: 3 })

    await userEvent.click(screen.getByRole("switch", { name: /Google'daki sayfanıza bağlantı/ }))
    expect(changes.at(-1)).toMatchObject({ profile_link: false })

    await userEvent.click(screen.getByRole("switch", { name: /Son yorumlardan alıntı göster/ }))
    expect(changes.at(-1)).toMatchObject({ excerpts: 0 })
  })

  it("keeps the shop's title, the storefront's own when empty, and says the rating is Google's", async () => {
    const changes = renderForm()
    const title = screen.getByLabelText("Başlık")

    expect(title).toHaveAttribute("placeholder", "Google'da bizi değerlendirenler")
    await userEvent.type(title, "Google'da biz")
    expect(changes.at(-1)).toMatchObject({ title: "Google'da biz" })
    expect(screen.getByText(/Puan ve sayı Google'ındır/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Yorumlar > Google yorumları" })).toHaveAttribute(
      "href",
      "/reviews/google"
    )
  })

  it("flags a title over the limit as the save would", () => {
    const section = {
      ...(newHomeSection("google_rating", "googlepuan") as GoogleRatingSection),
      title: "x".repeat(61),
    }
    expect(sectionProblems(section)).toHaveProperty("title")
  })
})
