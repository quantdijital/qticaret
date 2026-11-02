import { moveWhatsappPhone } from "../store-whatsapp-phone"

function fakes(storefront: Record<string, unknown> | null, storeWhatsapp: string | null) {
  const saved: unknown[] = []
  const recorded: unknown[] = []
  const settings = {
    listSettingsSections: jest.fn(async () =>
      Promise.resolve(storefront ? [{ values: storefront }] : [])
    ),
    readSection: jest.fn(async () =>
      Promise.resolve({ values: { whatsapp_phone: storeWhatsapp }, version: 1 })
    ),
    saveSection: jest.fn(async (_name: string, patch: unknown) => {
      saved.push(patch)
      return Promise.resolve({})
    }),
  }
  const audit = {
    record: jest.fn(async (entry: unknown) => {
      recorded.push(entry)
      return Promise.resolve({})
    }),
  }
  return { settings, audit, saved, recorded }
}

describe("WhatsApp number move (adr/0048 migration script)", () => {
  it("copies the storefront's number into the store details, as the system", async () => {
    const { settings, audit, saved, recorded } = fakes({ whatsapp_phone: "+905342551145" }, null)
    expect(await moveWhatsappPhone(settings as never, audit as never)).toBe(true)
    expect(settings.saveSection).toHaveBeenCalledWith(
      "store",
      { whatsapp_phone: "+905342551145" },
      null
    )
    expect(saved).toHaveLength(1)
    expect(recorded).toEqual([
      expect.objectContaining({ kind: "system", resource_type: "platform_settings" }),
    ])
  })

  it.each([
    ["a shop that never saved its storefront", null, null],
    ["a storefront without a number", { whatsapp_phone: null }, null],
    ["store details that already have one", { whatsapp_phone: "+905342551145" }, "+905321234567"],
  ])("leaves %s", async (_label, storefront, current) => {
    const { settings, audit, saved, recorded } = fakes(storefront, current)
    expect(await moveWhatsappPhone(settings as never, audit as never)).toBe(false)
    expect([saved, recorded]).toEqual([[], []])
  })
})
