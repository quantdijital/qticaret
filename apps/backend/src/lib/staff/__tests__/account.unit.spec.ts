import { randomBytes } from "node:crypto"
import {
  EMAIL_CHANGE_TTL_MS,
  emailChangeLink,
  jobTitleOf,
  openEmailChange,
  sealEmailChange,
  withJobTitle,
} from "../account"

const KEY = randomBytes(32)
const NOW = Date.UTC(2026, 10, 6, 9)
const CHANGE = { user_id: "user_1", from: "eski@ornek.com", to: "yeni@ornek.com" }

describe("a staff member's job title", () => {
  it("reads the title from the metadata, and none when it is blank or not text", () => {
    expect(jobTitleOf({ job_title: "Satış sorumlusu" })).toBe("Satış sorumlusu")
    expect(jobTitleOf({ job_title: "  " })).toBeNull()
    expect(jobTitleOf({ job_title: 3 })).toBeNull()
    expect(jobTitleOf(null)).toBeNull()
  })

  it("sets the title beside what the metadata held, and takes it off as null", () => {
    expect(withJobTitle({ theme: "light" }, "Depo")).toEqual({ theme: "light", job_title: "Depo" })
    expect(withJobTitle({ job_title: "Depo" }, null)).toEqual({ job_title: null })
    expect(withJobTitle(undefined, "Depo")).toEqual({ job_title: "Depo" })
  })
})

describe("an address change's link", () => {
  it("opens to what was sealed, for a day", () => {
    const { token, claim } = sealEmailChange(CHANGE, KEY, NOW)

    expect(claim).toMatchObject({ ...CHANGE, expires_at: NOW + EMAIL_CHANGE_TTL_MS })
    expect(claim.nonce).toMatch(/^[0-9a-f]{32}$/)
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
    // Neither address is readable in the link
    expect(Buffer.from(token, "base64url").toString("latin1")).not.toContain("ornek.com")
    expect(openEmailChange(token, KEY, NOW + 1000)).toEqual(claim)
    expect(openEmailChange(token, KEY, NOW + EMAIL_CHANGE_TTL_MS)).toBeNull()
  })

  it("does not open with another key, changed, or as anything else", () => {
    const { token } = sealEmailChange(CHANGE, KEY, NOW)
    const bytes = Buffer.from(token, "base64url")
    bytes[bytes.length - 1] = (bytes[bytes.length - 1] ?? 0) ^ 1

    expect(openEmailChange(token, randomBytes(32), NOW)).toBeNull()
    expect(openEmailChange(bytes.toString("base64url"), KEY, NOW)).toBeNull()
    expect(openEmailChange("not-a-token", KEY, NOW)).toBeNull()
    expect(openEmailChange("", KEY, NOW)).toBeNull()
  })

  it("seals a new nonce each time: two asks are two links", () => {
    const first = sealEmailChange(CHANGE, KEY, NOW)
    const second = sealEmailChange(CHANGE, KEY, NOW)
    expect(first.claim.nonce).not.toBe(second.claim.nonce)
    expect(first.token).not.toBe(second.token)
  })

  it("carries the token after `#`, where no log sees it", () => {
    expect(emailChangeLink("abc_-1", "https://panel.example")).toBe(
      "https://panel.example/confirm-email#token=abc_-1"
    )
  })
})
