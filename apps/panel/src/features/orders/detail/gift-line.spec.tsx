import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { GiftLineDetails } from "./gift-line"

// Links as plain anchors with their search: the line is rendered without a router
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    search,
    children,
    ...rest
  }: {
    to: string
    search: { card: string }
    children: ReactNode
    "aria-label"?: string
  }) => (
    <a href={`${to}?card=${search.card}`} aria-label={rest["aria-label"]}>
      {children}
    </a>
  ),
}))

const RECIPIENT = { recipient_email: "ayse@example.com", recipient_name: "Ayşe Yılmaz" }

describe("GiftLineDetails", () => {
  it("lists the issued cards, each opening its card, and who they went to", () => {
    render(
      <GiftLineDetails
        metadata={{
          qt_gift: RECIPIENT,
          qt_gift_cards: [
            { id: "gcard_1", last4: "1234" },
            { id: "gcard_2", last4: "5678" },
          ],
        }}
      />
    )
    expect(screen.getByText(/^Hediye kartları:/)).toHaveTextContent(
      "Hediye kartları: •••• 1234, •••• 5678"
    )
    expect(screen.getByRole("link", { name: "•••• 1234 kartını aç" })).toHaveAttribute(
      "href",
      "/promotions/gift-cards?card=gcard_1"
    )
    expect(screen.getByRole("link", { name: "•••• 5678 kartını aç" })).toHaveAttribute(
      "href",
      "/promotions/gift-cards?card=gcard_2"
    )
    expect(screen.getByText("Alıcı: Ayşe Yılmaz (ayse@example.com)")).toBeInTheDocument()
    expect(screen.queryByText(/ödeme alınınca/)).toBeNull()
  })

  it("names the recipient before the cards are issued", () => {
    render(<GiftLineDetails metadata={{ qt_gift: { recipient_email: "ayse@example.com" } }} />)
    expect(screen.getByText("Alıcı: ayse@example.com")).toBeInTheDocument()
    expect(
      screen.getByText("Kart, ödeme alınınca üretilip alıcıya e-postayla gönderilir.")
    ).toBeInTheDocument()
    expect(screen.queryByText(/Hediye kartları/)).toBeNull()
  })

  it("shows nothing under a line that is not a gift card", () => {
    const { container } = render(<GiftLineDetails metadata={{ note: "paket" }} />)
    expect(container).toBeEmptyDOMElement()
  })
})
