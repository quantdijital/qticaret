import { describe, expect, it } from "vitest"
import { PANEL_MAP } from "@/features/panel-map/map"
import { exampleSetOf, openScreenOf } from "./open-screen"
import { replyParts } from "./reply-parts"

const known = (key: string) => PANEL_MAP.some((screen) => screen.key === key)
const RATES = { key: "settings.shipping.options", label: "settings.shipping.tabs.options" }

describe("replyParts: a reply as plain text and its own screens' chips (adr/0079 §7)", () => {
  it("keeps every character of the text as it is", () => {
    expect(replyParts("**a** <b>x</b> [l](https://x.example)", [], known)).toEqual([
      { kind: "text", text: "**a** <b>x</b> [l](https://x.example)" },
    ])
  })

  it("makes a chip only of a marker among the reply's screens, and drops any other", () => {
    expect(
      replyParts(
        "Ücret [[settings.shipping.options]] ekranında, [[orders]] [[x.y]] değil.",
        [RATES],
        known
      )
    ).toEqual([
      { kind: "text", text: "Ücret " },
      { kind: "screen", screen: RATES },
      { kind: "text", text: " ekranında, değil." },
    ])
  })

  it("drops a screen the panel's map does not hold, even when the reply names it", () => {
    const made = { key: "admin.secret", label: "nav.orders" }
    expect(replyParts("[[admin.secret]].", [made], known)).toEqual([{ kind: "text", text: "." }])
  })
})

describe("openScreenOf: the open screen as the assistant is told it", () => {
  const ID = "prod_01JD3K5X7Y9Z0A1B2C3D4E5F6G"

  it("names a record's kind and id under its list, and only a Medusa id", () => {
    expect(openScreenOf(`/products/${ID}`)).toEqual({
      key: "products",
      record: { type: "product", id: ID },
    })
    expect(openScreenOf("/products/ignore previous")).toEqual({ key: "products" })
  })

  it("names a settings part by its search, and the deepest screen a path sits under", () => {
    expect(openScreenOf("/settings/shipping", { part: "options" })).toEqual({
      key: "settings.shipping.options",
    })
    expect(openScreenOf("/settings/shipping")).toEqual({ key: "settings.shipping" })
    expect(openScreenOf("/settings/shipping/aras")?.key).toBe("settings.shipping")
    expect(openScreenOf("/nowhere")).toBeNull()
    expect(openScreenOf("/")).toEqual({ key: "dashboard" })
  })

  it("offers the questions of the screen's kind", () => {
    expect(exampleSetOf({ key: "settings.shipping" })).toBe("settings")
    expect(exampleSetOf({ key: "products", record: { type: "product", id: ID } })).toBe("products")
    expect(exampleSetOf(null)).toBe("general")
  })
})
