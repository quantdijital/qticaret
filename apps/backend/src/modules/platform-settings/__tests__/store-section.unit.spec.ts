import { storeSection } from "../sections/store"

const { full, patch, defaults } = storeSection

describe("store section", () => {
  it("starts without contact details, and its defaults pass its own checks", () => {
    expect(full.safeParse(defaults).success).toBe(true)
    expect(defaults).toMatchObject({
      contact_email: null,
      contact_phone: null,
      whatsapp_phone: null,
      opening_hours: [],
      map_url: null,
    })
  })

  it("takes how the shop is reached: WhatsApp, a map and its hours, sorted", () => {
    const parsed = patch.parse({
      whatsapp_phone: "0534 255 11 45",
      map_url: " https://maps.app.goo.gl/abc123 ",
      opening_hours: [
        { day: 6, opens: "08:00", closes: "16:00" },
        { day: 1, opens: "13:00", closes: "19:00" },
        { day: 1, opens: "08:00", closes: "12:00" },
        { day: 5, opens: "20:00", closes: "24:00" },
      ],
    })

    expect(parsed.whatsapp_phone).toBe("+905342551145")
    expect(parsed.map_url).toBe("https://maps.app.goo.gl/abc123")
    expect(parsed.opening_hours).toEqual([
      { day: 1, opens: "08:00", closes: "12:00" },
      { day: 1, opens: "13:00", closes: "19:00" },
      { day: 5, opens: "20:00", closes: "24:00" },
      { day: 6, opens: "08:00", closes: "16:00" },
    ])
  })

  it.each([
    ["a range that closes before it opens", [{ day: 1, opens: "19:00", closes: "08:00" }]],
    ["a range that closes when it opens", [{ day: 1, opens: "08:00", closes: "08:00" }]],
    [
      "two ranges that overlap on a day",
      [
        { day: 2, opens: "08:00", closes: "13:00" },
        { day: 2, opens: "12:00", closes: "18:00" },
      ],
    ],
    ["a day that is not a weekday", [{ day: 0, opens: "08:00", closes: "18:00" }]],
    ["a time that is not HH:MM", [{ day: 1, opens: "8:00", closes: "18:00" }]],
    ["24:00 as an opening", [{ day: 1, opens: "24:00", closes: "24:00" }]],
  ])("refuses %s", (_, opening_hours) => {
    const result = patch.safeParse({ opening_hours })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toMatch(/platform_settings\.|Invalid|Too/)
  })

  it("refuses a map that is no https address and a WhatsApp number that is no number", () => {
    for (const map_url of ["http://maps.google.com", "javascript:alert(1)", "/harita"]) {
      expect(patch.safeParse({ map_url }).success).toBe(false)
    }
    expect(patch.safeParse({ whatsapp_phone: "12" }).success).toBe(false)
  })
})
