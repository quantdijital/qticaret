import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { OpeningRange, StoreSettings } from "@/features/settings/api/sections"
import { OpeningHoursCard } from "./opening-hours-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const URL = "/admin/platform-settings/store"

const saved = (opening_hours: OpeningRange[]): StoreSettings => ({
  contact_email: null,
  contact_phone: null,
  whatsapp_phone: null,
  opening_hours,
  map_url: null,
  etbis_qr_url: null,
  timezone: "Europe/Istanbul",
  weight_unit: "g",
  dimension_unit: "cm",
})

function renderCard(opening_hours: OpeningRange[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <OpeningHoursCard saved={saved(opening_hours)} />
    </QueryClientProvider>
  )
}

const posted = () =>
  fetchMock.mock.calls.filter(([, init]) => (init as { method?: string } | undefined)?.method)

async function setTime(label: string, time: string) {
  const input = screen.getByLabelText(label)
  await userEvent.clear(input)
  await userEvent.type(input, time)
}

const save = () => userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

describe("OpeningHoursCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation((_url: string, init?: { body?: object }) =>
      Promise.resolve({ section: "store", values: { ...saved([]), ...init?.body }, version: 2 })
    )
  })

  it("shows a day without hours as closed and leaves a closed day out of the save", async () => {
    renderCard([
      { day: 1, opens: "09:00", closes: "18:00" },
      { day: 6, opens: "10:00", closes: "14:00" },
      { day: 7, opens: "20:00", closes: "24:00" },
    ])

    expect(screen.getByRole("switch", { name: "Salı açık" })).not.toBeChecked()
    expect(screen.getAllByText("Kapalı")).toHaveLength(4)
    // Midnight shows as 00:00, which a time field can hold
    expect(screen.getByLabelText("Pazar: kapanış")).toHaveValue("00:00")

    await userEvent.click(screen.getByRole("switch", { name: "Cumartesi açık" }))
    await setTime("Pazartesi: açılış", "08:30")
    await save()

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(URL, {
        method: "POST",
        body: {
          opening_hours: [
            { day: 1, opens: "08:30", closes: "18:00" },
            { day: 7, opens: "20:00", closes: "24:00" },
          ],
        },
      })
    })
  })

  it("adds a lunch break and copies Monday's hours to the weekdays", async () => {
    renderCard([{ day: 1, opens: "09:00", closes: "18:00" }])

    await userEvent.click(screen.getByRole("button", { name: "Pazartesi: ara ekle" }))
    expect(screen.getByLabelText("Pazartesi, 1. aralık: kapanış")).toHaveValue("12:00")
    expect(screen.getByLabelText("Pazartesi, 2. aralık: açılış")).toHaveValue("13:00")

    await userEvent.click(
      screen.getByRole("button", { name: "Pazartesi saatlerini hafta içine uygula" })
    )
    expect(screen.getByRole("switch", { name: "Cuma açık" })).toBeChecked()
    expect(screen.getByRole("switch", { name: "Cumartesi açık" })).not.toBeChecked()
    await save()

    const lunch = (day: number) => [
      { day, opens: "09:00", closes: "12:00" },
      { day, opens: "13:00", closes: "18:00" },
    ]
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(URL, {
        method: "POST",
        body: { opening_hours: [1, 2, 3, 4, 5].flatMap(lunch) },
      })
    })
  })

  it("refuses overlapping ranges and a range that closes before it opens, sending nothing", async () => {
    renderCard([{ day: 1, opens: "09:00", closes: "18:00" }])

    await userEvent.click(screen.getByRole("button", { name: "Pazartesi: ara ekle" }))
    await setTime("Pazartesi, 2. aralık: açılış", "11:00")
    await save()

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Bu aralık, aynı gündeki başka bir aralıkla çakışıyor."
    )
    expect(screen.getByLabelText("Pazartesi, 2. aralık: açılış")).toHaveAttribute(
      "aria-invalid",
      "true"
    )

    // Fixed: the error goes as it is corrected; a backwards range is the next one
    await setTime("Pazartesi, 2. aralık: açılış", "13:00")
    await waitFor(() => {
      expect(screen.queryByRole("alert")).toBeNull()
    })
    await setTime("Pazartesi, 2. aralık: kapanış", "12:30")
    await save()
    expect(await screen.findByRole("alert")).toHaveTextContent("Kapanış, açılıştan sonra olmalı.")
    expect(posted()).toEqual([])
  })

  it("lets a day have three ranges at most, and a removed one go", async () => {
    renderCard([{ day: 3, opens: "09:00", closes: "18:00" }])

    await userEvent.click(screen.getByRole("button", { name: "Çarşamba: ara ekle" }))
    await userEvent.click(screen.getByRole("button", { name: "Çarşamba: ara ekle" }))
    expect(screen.queryByRole("button", { name: "Çarşamba: ara ekle" })).toBeNull()

    await userEvent.click(screen.getByRole("button", { name: "Çarşamba, 3. aralık: kaldır" }))
    expect(screen.queryByLabelText("Çarşamba, 3. aralık: açılış")).toBeNull()
    expect(screen.getByRole("button", { name: "Çarşamba: ara ekle" })).toBeInTheDocument()
  })
})
