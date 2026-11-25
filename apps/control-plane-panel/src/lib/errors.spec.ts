import { describe, expect, it } from "vitest"
import en from "../locales/en.json" with { type: "json" }
import tr from "../locales/tr.json" with { type: "json" }
import { ApiError } from "./api"
import {
  AI_CREDITS_CODES,
  API_ERROR_CODES,
  CP_ERROR_CODES,
  PASSWORD_PROBLEMS,
  PROVISIONING_CODES,
  errorKey,
  errorText,
} from "./errors"
import { i18next } from "./i18n"
import { StepUpCancelled } from "./step-up"

const t = i18next.getFixedT("tr")

function keysOf(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) {
    return [prefix]
  }
  return Object.entries(value).flatMap(([key, inner]) =>
    keysOf(inner, prefix ? `${prefix}.${key}` : key)
  )
}

function valuesOf(value: unknown): string[] {
  if (typeof value === "string") {
    return [value]
  }
  return typeof value === "object" && value !== null ? Object.values(value).flatMap(valuesOf) : []
}

describe("the control plane's refusals in words", () => {
  it("puts a cp.* key into Turkish", () => {
    expect(errorText(t, new ApiError(403, "cp.last_owner", "not_allowed"))).toBe(
      "Son etkin sahip rolünü ya da erişimini kaybedemez. Önce başka bir üyeye sahip rolü verin."
    )
  })

  it("finds the key inside a validation sentence (Medusa joins a body's failures into one)", () => {
    const error = new ApiError(
      400,
      "Invalid request: Value for field 'first_name': cp.name_required",
      "invalid_data"
    )
    expect(errorKey(error)).toBe("errors.cp.name_required")
  })

  it("puts the shared password rule's keys into words", () => {
    for (const problem of PASSWORD_PROBLEMS) {
      expect(errorKey(new ApiError(400, `auth.password_${problem}`, "invalid_data"))).toBe(
        `errors.password.${problem}`
      )
    }
    expect(errorText(t, new ApiError(400, "auth.password_too_short", "invalid_data"))).toBe(
      "Şifre en az 10 karakter olmalı."
    )
  })

  it("puts a setup refusal into words (Ek C10: busy, status, no provisioner)", () => {
    expect(errorText(t, new ApiError(409, "cp.provisioning_busy", "conflict"))).toBe(
      "Bu mağazada bir çalışma sürüyor; bitince yeniden deneyin."
    )
    expect(errorKey(new ApiError(409, "provisioning.tenant_status", "conflict"))).toBe(
      "errors.provisioning.tenant_status"
    )
    expect(errorKey(new ApiError(503, "cp.provisioner_unavailable", "unavailable"))).toBe(
      "errors.cp.provisioner_unavailable"
    )
  })

  it("knows the control plane's generic keys", () => {
    expect(errorKey(new ApiError(403, "errors.csrf_rejected", "not_allowed"))).toBe(
      "errors.api.csrf_rejected"
    )
  })

  it("falls back on the status for Medusa's own English sentences, never showing them", () => {
    const text = errorText(t, new ApiError(401, "Invalid email or password", "unauthorized"))
    expect(text).toBe("Oturumunuz kapandı. Yeniden giriş yapın.")
  })

  it("keeps a server error and a network failure to the generic line", () => {
    expect(errorText(t, new ApiError(500, "boom", null))).toBe(
      "İşlem tamamlanamadı. Biraz sonra tekrar deneyin."
    )
    expect(errorText(t, new TypeError("Failed to fetch"))).toBe(
      "İşlem tamamlanamadı. Biraz sonra tekrar deneyin."
    )
  })

  it("says nothing went wrong when the step-up dialog was closed", () => {
    expect(errorText(t, new StepUpCancelled())).toBe("İşlem yapılmadı.")
  })

  it("has words for every known key in both languages", () => {
    const trKeys = new Set(keysOf(tr))
    const enKeys = new Set(keysOf(en))
    for (const code of CP_ERROR_CODES) {
      expect(trKeys).toContain(`errors.cp.${code}`)
      expect(enKeys).toContain(`errors.cp.${code}`)
    }
    for (const code of API_ERROR_CODES) {
      expect(trKeys).toContain(`errors.api.${code}`)
    }
    for (const code of PROVISIONING_CODES) {
      expect(trKeys).toContain(`errors.provisioning.${code}`)
      expect(enKeys).toContain(`errors.provisioning.${code}`)
    }
    for (const code of AI_CREDITS_CODES) {
      expect(trKeys).toContain(`errors.ai_credits.${code}`)
      expect(enKeys).toContain(`errors.ai_credits.${code}`)
    }
  })

  it("puts the AI credits' refusals into words (adr/0085: validators, conflicts, gateway)", () => {
    expect(errorText(t, new ApiError(409, "cp.ai_credit_order_closed", "conflict"))).toBe(
      "Bu talep artık beklemiyor: ödenmiş ya da iptal edilmiş."
    )
    const blank = new ApiError(
      400,
      "Invalid request: Value for field 'note': cp.ai_credit_note_required",
      "invalid_data"
    )
    expect(errorKey(blank)).toBe("errors.cp.ai_credit_note_required")
    expect(errorKey(new ApiError(404, "ai_credits.pack_unknown", "not_found"))).toBe(
      "errors.ai_credits.pack_unknown"
    )
  })
})

describe("the locale files", () => {
  it("hold the same keys in Turkish and English", () => {
    expect(keysOf(en).sort()).toEqual(keysOf(tr).sort())
  })

  it("say nothing with an exclamation mark in Turkish (docs/18 §2)", () => {
    expect(valuesOf(tr).filter((text) => text.includes("!"))).toEqual([])
  })
})
