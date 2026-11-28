import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it } from "vitest"
import "@/lib/i18n"
import { DEFAULT_LAYOUT } from "./parts"
import type { PartKey } from "./parts"
import { ViewMenu } from "./view-menu"
import { DEFAULT_VIEW } from "./view-prefs"
import type { ViewPrefs } from "./view-prefs"

let last: ViewPrefs = DEFAULT_VIEW

function Menu({ shopHidden = [] }: { shopHidden?: PartKey[] }) {
  const [prefs, setPrefs] = useState<ViewPrefs>(DEFAULT_VIEW)
  return (
    <ViewMenu
      layout={{ ...DEFAULT_LAYOUT, hidden: shopHidden }}
      // A tour: no parcel; its stock is its departures'
      draws={(key) => key !== "shipping"}
      unused={(key) => key === "stock"}
      simple={false}
      prefs={prefs}
      onPrefs={(next) => {
        last = next
        setPrefs(next)
      }}
    />
  )
}

describe("the product page's Görünüm menu", () => {
  it("switches the person's own parts, greys what the kind does not use, locks the locked", async () => {
    const user = userEvent.setup()
    render(<Menu shopHidden={["faq"]} />)
    await user.click(screen.getByRole("button", { name: "Görünüm" }))

    const row = (part: string) => {
      const found = document.querySelector<HTMLElement>(`[data-view-row="${part}"]`)
      if (!found) {
        throw new Error(part)
      }
      return within(found)
    }
    // Locked: no switch; a part this product does not draw is not listed
    expect(row("general").queryByRole("switch")).toBeNull()
    expect(document.querySelector('[data-view-row="shipping"]')).toBeNull()
    // The shop hid it: said, not switched here
    expect(row("faq").getByText("Mağazanın sayfa düzeninde gizli")).toBeInTheDocument()
    expect(row("faq").getByRole("switch")).toBeDisabled()

    // A tour's stock: off by default, said why, still turned on
    expect(row("stock").getByText("Bu ürün türünde kullanılmıyor")).toBeInTheDocument()
    expect(row("stock").getByRole("switch")).not.toBeChecked()
    await user.click(row("stock").getByRole("switch"))
    expect(last).toEqual({ hidden: [], shown: ["stock"] })

    await user.click(row("media").getByRole("switch"))
    expect(last).toEqual({ hidden: ["media"], shown: ["stock"] })

    await user.click(screen.getByRole("button", { name: "Varsayılana dön" }))
    expect(last).toEqual(DEFAULT_VIEW)
  })
})
