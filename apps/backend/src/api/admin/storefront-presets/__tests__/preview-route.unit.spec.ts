import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { GET } from "../[pack]/[code]/preview/route"

const mockPreview = jest.fn()
jest.mock("../preview", () => ({
  presetPreview: (...args: unknown[]): unknown => mockPreview(...args),
}))

function call(params: Record<string, string>) {
  const headers: Record<string, string> = {}
  const res = {
    setHeader: jest.fn((name: string, value: string) => {
      headers[name] = value
    }),
    send: jest.fn(),
  }
  const req = { params, scope: {} } as unknown as AuthenticatedMedusaRequest
  return { run: () => GET(req, res as unknown as MedusaResponse), res, headers }
}

describe("GET /admin/storefront-presets/:pack/:code/preview (adr/0063 §7)", () => {
  beforeEach(() => {
    mockPreview.mockReset()
  })

  it("sends the picture as an image never read as anything else", async () => {
    const image = Buffer.from("RIFF....WEBP")
    mockPreview.mockResolvedValue(image)
    const { run, res, headers } = call({ pack: "general", code: "grafit" })
    await run()
    expect(res.send).toHaveBeenCalledWith(image)
    expect(headers).toEqual({
      "Content-Type": "image/webp",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
      "Cache-Control": "private, max-age=300",
    })
  })

  it("answers not found for no picture, never reading a path no code names", async () => {
    mockPreview.mockResolvedValue(null)
    await expect(call({ pack: "general", code: "grafit" }).run()).rejects.toMatchObject({
      type: "not_found",
      message: "storefront_preset.unknown",
    })
    for (const params of [
      { pack: "general", code: "../grafit" },
      { pack: "../../etc", code: "grafit" },
      { pack: "general", code: "Grafit" },
    ]) {
      const { run, res } = call(params)
      await expect(run()).rejects.toMatchObject({ type: "not_found" })
      expect(res.send).not.toHaveBeenCalled()
    }
    expect(mockPreview).toHaveBeenCalledTimes(1)
  })
})
