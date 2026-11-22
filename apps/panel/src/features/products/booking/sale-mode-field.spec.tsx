import { render, screen } from "@testing-library/react"
import { useForm } from "react-hook-form"
import { describe, expect, it } from "vitest"
import "@/lib/i18n"
import type { SaleMode } from "@/features/products/api/booking"
import { SaleModeField } from "./sale-mode-field"
import { settingsDraftOf } from "./slot-schemas"
import type { SettingsDraft } from "./slot-schemas"

function Form({ mode }: { mode?: SaleMode }) {
  const draft = settingsDraftOf(null, [])
  const form = useForm<SettingsDraft>({
    defaultValues: { ...draft, ...(mode ? { sale_mode: mode } : {}) },
  })
  return <SaleModeField control={form.control} />
}

describe("SaleModeField (adr/0076 Ek 2026-11-23)", () => {
  it("starts on online sale, today's way, and says where requests land", () => {
    render(<Form />)
    const field = screen.getByRole("combobox", { name: "Satış biçimi" })
    expect(field).toHaveTextContent("Çevrim içi satış")
    expect(screen.getByText(/Müşteriler > İletişim mesajları/)).toBeInTheDocument()
  })

  it("names the call-me choice as taking no payment", () => {
    render(<Form mode="request" />)
    expect(screen.getByRole("combobox", { name: "Satış biçimi" })).toHaveTextContent(
      "Sizi arayalım (ödeme yok)"
    )
  })
})
