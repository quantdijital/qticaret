import { AdminPostBrand, AdminUpdateBrand } from "../validators"

const logo = (logo_file_id: unknown) =>
  AdminUpdateBrand.safeParse({ logo_file_id }).success &&
  AdminPostBrand.safeParse({ name: "Örnek", logo_file_id }).success

describe("a brand's logo key in the admin body", () => {
  it.each([
    // Keys storage makes: local (time-name.ext), S3 (name-ULID.ext, a folder inside), Medusa's ids
    "1763290000000-genis-logo.png",
    "genis-logo-01JD8X2Q4W5E6R7T8Y9U0I1O2P.png",
    "klasor/genis-logo-01JD8X2Q4W5E6R7T8Y9U0I1O2P.webp",
    "file_01NOPE",
    "logo..eski.png",
    null,
  ])("takes %s", (key) => {
    expect(logo(key)).toBe(true)
  })

  it.each([
    "../.env",
    "..",
    "a/../../b.png",
    "a\\..\\b.png",
    "/etc/passwd",
    "\\windows\\a.png",
    "x".repeat(65),
  ])("refuses %s", (key) => {
    expect(logo(key)).toBe(false)
  })
})
