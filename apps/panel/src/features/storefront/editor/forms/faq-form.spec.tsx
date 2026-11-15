import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { FaqSection } from "@/features/storefront/api/layout"
import { sectionProblems } from "@/features/storefront/layout/problems"
import { newHomeSection } from "@/features/storefront/layout/sections"
import { FIELD_IDS } from "./field-registry"
import { FaqForm } from "./faq-form"

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: vi.fn() }, admin: {} } }))

/** The form as the editor holds it: every change kept. */
function renderForm(section = newHomeSection("faq", "sss0000001") as FaqSection) {
  const changes: FaqSection[] = []
  function Holder() {
    const [value, setValue] = useState(section)
    return (
      <FaqForm
        section={value}
        problems={sectionProblems(value)}
        onChange={(next) => {
          changes.push(next)
          setValue(next)
        }}
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

/** docs/tema/bilesen-denetimi (b) 8: how the questions open. */
describe("FaqForm's switches", () => {
  it("starts with both off, as before: all closed, each opened on its own", () => {
    renderForm()

    expect(screen.getByRole("switch", { name: /İlk soru açık gelsin/ })).not.toBeChecked()
    expect(screen.getByRole("switch", { name: /Aynı anda tek soru açık/ })).not.toBeChecked()
    expect(document.getElementById(FIELD_IDS.content("sss0000001", "open_first"))).not.toBeNull()
    expect(document.getElementById(FIELD_IDS.content("sss0000001", "single_open"))).not.toBeNull()
  })

  it("saves each as an off/on step, keeping the other as saved", async () => {
    const user = userEvent.setup()
    const changes = renderForm({
      ...(newHomeSection("faq", "sss0000001") as FaqSection),
      single_open: "on",
    })

    await user.click(screen.getByRole("switch", { name: /İlk soru açık gelsin/ }))
    expect(changes.at(-1)).toMatchObject({ open_first: "on", single_open: "on" })

    await user.click(screen.getByRole("switch", { name: /Aynı anda tek soru açık/ }))
    expect(changes.at(-1)).toMatchObject({ open_first: "on", single_open: "off" })
  })
})
