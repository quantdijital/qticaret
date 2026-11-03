import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import "@/lib/i18n"
import { noSkips, preview } from "@/features/bulk-messages/bulk-messages.fixtures"
import { AudienceCount } from "./audience-count"

describe("AudienceCount (adr/0050 §3)", () => {
  it("shows who it reaches, who the sources name, and each reason left out in words", () => {
    render(<AudienceCount preview={preview()} />)

    expect(screen.getByText("1.240 kişi")).toBeInTheDocument()
    expect(
      screen.getByText("Kaynaklarda 1.500 kişi var; 260 kişi dışarıda kalıyor.")
    ).toBeInTheDocument()
    const reasons = within(screen.getByLabelText("Dışarıda kalanlar"))
    const rows = reasons
      .getAllByRole("term")
      .map((term) => [term.textContent, term.nextElementSibling?.textContent])
    expect(rows).toEqual([
      ["Bu kanalda izni yok", "200"],
      ["İzni İYS'ye henüz bildirilmedi", "40"],
      ["Son 24 saatte başka bir toplu ileti aldı", "20"],
    ])
    // Nothing waits for the next day within the quota
    expect(screen.queryByText(/ertesi gün/)).toBeNull()
  })

  it("says what the day's quota leaves for the next day", () => {
    render(
      <AudienceCount
        preview={preview({ quota: { limit: 500, left: 300, today: 300, later: 940 } })}
      />
    )

    expect(
      screen.getByText(
        "Günlük sınır nedeniyle bugün 300 kişiye gider; kalan 940 kişiye ertesi gün 03:00'ten sonra devam eder."
      )
    ).toBeInTheDocument()
  })

  it("says so when nobody is left out, and waits with a skeleton", () => {
    const { rerender } = render(<AudienceCount preview={undefined} />)
    expect(document.querySelector("[aria-busy=true]")).not.toBeNull()

    rerender(
      <AudienceCount preview={preview({ audience: 10, eligible: 10, excluded: noSkips() })} />
    )
    expect(screen.getByText("10 kişi")).toBeInTheDocument()
    expect(screen.getByText("Dışarıda kalan yok.")).toBeInTheDocument()
  })
})
