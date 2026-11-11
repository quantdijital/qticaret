import { describe, expect, it } from "vitest"
import { i18next } from "@/lib/i18n"
import { step } from "@/test/runs"
import { codeText, durationText, isWarning, kindName, outputText, stepName } from "./words"

const t = i18next.getFixedT("tr")

describe("a run in words (Ek C10)", () => {
  it("names every step in Turkish; one it does not know as written", () => {
    expect(stepName(t, "migrate")).toBe("Veritabanı şeması")
    expect(stepName(t, "rotate_keys")).toBe("rotate_keys")
  })

  it("says a code, a command's failure, an undo that failed and one it does not know", () => {
    expect(codeText(t, "provisioning.no_package")).toBe(
      "Mağazanın paketi yok. Önce paket atanmalı."
    )
    expect(codeText(t, "provisioning.migrate_timeout")).toBe(
      "Veritabanı şemasının kurulumu süre sınırını aştı."
    )
    expect(codeText(t, "provisioning.compensation_failed:provisioning.database_failed")).toBe(
      "Geri alma tamamlanamadı: Veritabanı işlemi tamamlanamadı."
    )
    expect(codeText(t, "cp.provisioning_busy")).toContain("çalışma sürüyor")
    expect(codeText(t, "provisioning.something_new")).toBe("Adım tamamlanamadı.")
    expect(codeText(t, null)).toBeNull()
  })

  it("tells a warning from a failure, and shows only outputs worth reading", () => {
    const invite = step("owner_invite", {
      error_code: "provisioning.mail_failed",
      output: { mailed: false },
    })
    const secrets = step("secrets", { output: { kid: "k_1", escrow_version: 1 } })

    expect(isWarning(invite)).toBe(true)
    expect(isWarning(step("health", { status: "failed", error_code: "x" }))).toBe(false)
    expect(outputText(t, invite)).toEqual(["E-posta gönderilmedi"])
    expect(outputText(t, secrets)).toEqual([])
    expect(durationText(t, "2026-11-11T10:00:00Z", "2026-11-11T10:01:05Z")).toBe("1 dk 5 sn")
    expect(durationText(t, "2026-11-11T10:00:00Z", null)).toBeNull()
  })

  it("says the sector pack's run and what it added (C12)", () => {
    expect(kindName(t, "apply_pack")).toBe("Sektör paketi")
    expect(
      outputText(
        t,
        step("sector_pack", {
          output: { pack: "cutlery", version: 2, added: 3, kept: 1, skipped: 0 },
        })
      )
    ).toEqual(["Sürüm 2", "3 öğe eklendi", "1 öğe mağazada zaten vardı, korundu"])
    expect(
      outputText(
        t,
        step("sector_pack", { output: { pack: "general", version: 1, added: 0, kept: 0 } })
      )
    ).toEqual(["Sürüm 1", "0 öğe eklendi"])
    expect(codeText(t, "provisioning.sector_pack_unknown")).toBe("Bu sektör paketi bu sürümde yok.")
  })
})
