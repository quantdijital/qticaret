import { isValidationError } from "../../../lib/errors"
import { mediaImportFetch, nameFromAddress } from "../import-fetch"

const keyOf = async (address: string) => {
  try {
    await mediaImportFetch.get(address)
  } catch (error) {
    return isValidationError(error) ? `${error.field ?? ""}:${error.safeMessage}` : String(error)
  }
  return "fetched"
}

describe("an image's address brought into the library (docs/04 SSRF)", () => {
  it.each([
    "not an address",
    "ftp://example.com/a.png",
    "http://127.0.0.1/a.png",
    "http://169.254.169.254/latest/meta-data",
    "https://user:secret@example.com/a.png",
    "http://[::1]/a.png",
  ])("refuses %s before anything leaves the server", async (address) => {
    await expect(keyOf(address)).resolves.toBe("url:media.import_address_refused")
  })

  it("names the file after the address's last segment", () => {
    expect(nameFromAddress("https://cdn.example.com/a/b/Yaz%20Kampanyas%C4%B1.jpg?w=10")).toBe(
      "Yaz Kampanyası.jpg"
    )
    expect(nameFromAddress("https://cdn.example.com/")).toBe("gorsel")
    expect(nameFromAddress("https://cdn.example.com/%E0")).toBe("gorsel")
  })
})
