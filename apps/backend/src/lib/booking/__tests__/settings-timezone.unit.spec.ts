import { TimeZone } from "../settings"

/**
 * PR #281 review: a dated product's zone is read by the database too
 * (`AT TIME ZONE`, adr/0077 §3), so only Area/City names are taken.
 */
describe("a dated product's time zone", () => {
  it.each(["Europe/Istanbul", "America/Argentina/Buenos_Aires", "Asia/Kolkata", "Etc/GMT+3"])(
    "takes the zone name %s",
    (zone) => {
      expect(TimeZone.safeParse(zone).success).toBe(true)
    }
  )

  it.each([
    // POSIX reads an offset with its sign turned: +03:00 would be three hours west
    "+03:00",
    "-05",
    "UTC+3",
    // Abbreviations may mean another zone, or none at all
    "EST",
    "UTC",
    "europe/istanbul",
    "Mars/Olympus",
    "Europe/Istanbul; DROP TABLE",
  ])("refuses %s", (zone) => {
    const read = TimeZone.safeParse(zone)
    expect(read.success).toBe(false)
    expect(read.error?.issues[0]?.message).toBe("booking.timezone_invalid")
  })
})
