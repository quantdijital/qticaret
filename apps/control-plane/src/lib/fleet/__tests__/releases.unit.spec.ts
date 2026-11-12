import { usageReportSchema } from "@qticaret/types/control-plane"
import {
  PostRelease,
  PostReleaseNotes,
  PostTargetRelease,
} from "../../../api/admin/cp/releases/validators"
import { RELEASE_VERSION, drifts, matchesTarget, sameCommit, sameRelease } from "../releases"

const FULL = "8a128bbe0c3d4e5f60718293a4b5c6d7e8f90a1b"

describe("releases (Ek C18)", () => {
  it("takes strict semver only, a subset of what a usage report may carry", () => {
    for (const good of ["0.0.1", "1.4.0", "10.20.30", "1.5.0-rc.1", "2.0.0-beta-2.x"]) {
      expect(RELEASE_VERSION.test(good)).toBe(true)
      // Every release can be matched against a report
      expect(usageReportSchema.shape.release.shape.version.safeParse(good).success).toBe(true)
    }
    for (const bad of [
      "1.4",
      "01.4.0",
      "1.04.0",
      "1.4.0+build.5",
      "v1.4.0",
      "1.4.0-",
      "1.4.0-a..b",
      "",
    ]) {
      expect(RELEASE_VERSION.test(bad)).toBe(false)
    }
  })

  it("matches a short and a full hash of one commit, never a different or too short one", () => {
    expect(sameCommit("8a128bb", FULL)).toBe(true)
    expect(sameCommit(FULL, "8A128BBE")).toBe(true)
    expect(sameCommit(FULL, FULL)).toBe(true)
    expect(sameCommit("8a128bc", FULL)).toBe(false)
    expect(sameCommit("8a128b", FULL)).toBe(false)
  })

  it("tells whether a shop runs its target: null when either side is missing", () => {
    const target = { version: "1.4.0", commit: FULL }

    expect(sameRelease({ version: "1.4.0", commit: "8a128bbe0c3d" }, target)).toBe(true)
    expect(sameRelease({ version: "1.4.1", commit: "8a128bbe0c3d" }, target)).toBe(false)
    expect(matchesTarget({ version: "1.4.0", commit: "8a128bbe" }, target)).toBe(true)
    expect(matchesTarget({ version: "1.3.0", commit: "0000000" }, target)).toBe(false)
    expect(matchesTarget(null, target)).toBeNull()
    expect(matchesTarget({ version: "1.4.0", commit: FULL }, null)).toBeNull()
    expect(drifts({ version: "1.3.0", commit: "0000000" }, target)).toBe(true)
    expect(drifts(null, target)).toBe(false)
    expect(drifts({ version: "1.3.0", commit: "0000000" }, null)).toBe(false)
  })

  it("takes a release's version, commit (any case) and note strictly", () => {
    expect(
      PostRelease.parse({ version: " 1.4.0 ", commit: "8A128BBE", notes: "Kargo düzeltmesi\r\n" })
    ).toEqual({ version: "1.4.0", commit: "8a128bbe", notes: "Kargo düzeltmesi" })
    expect(
      PostRelease.parse({ version: "1.4.0", commit: "8a128bbe", notes: "  " }).notes
    ).toBeNull()
    for (const body of [
      { version: "1.4", commit: "8a128bbe" },
      { version: "1.4.0", commit: "8a128" },
      { version: "1.4.0", commit: "zz128bbe" },
      { version: "1.4.0", commit: `${FULL}0` },
      { version: "1.4.0", commit: "8a128bbe", notes: "a\u0000b" },
      { version: "1.4.0", commit: "8a128bbe", notes: "a\u202eb" },
      { version: "1.4.0", commit: "8a128bbe", notes: "x".repeat(2001) },
      { version: "1.4.0", commit: "8a128bbe", extra: true },
    ]) {
      expect(PostRelease.safeParse(body).success).toBe(false)
    }
    expect(PostReleaseNotes.parse({ notes: null })).toEqual({ notes: null })
    expect(PostReleaseNotes.safeParse({ notes: "ok", version: "2.0.0" }).success).toBe(false)
  })

  it("asks a target's reason always, the release or null", () => {
    expect(PostTargetRelease.parse({ release_id: null, reason: " Geri alındı " })).toEqual({
      release_id: null,
      reason: "Geri alındı",
    })
    expect(PostTargetRelease.safeParse({ release_id: "rel_1", reason: "ok" }).success).toBe(false)
    expect(PostTargetRelease.safeParse({ release_id: "rel_1" }).success).toBe(false)
    expect(PostTargetRelease.safeParse({ reason: "Yeni sürüm" }).success).toBe(false)
    expect(
      PostTargetRelease.safeParse({ release_id: "rel_1", reason: "x".repeat(501) }).success
    ).toBe(false)
  })
})
