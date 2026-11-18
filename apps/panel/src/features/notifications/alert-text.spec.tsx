import { renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { AI_SERVICE_IDS } from "@/features/ai/services"
import { i18next } from "@/lib/i18n"
import { useAlertText } from "./alert-text"

const account = (provider: string) =>
  renderHook(() => useAlertText({ kind: "provider_account", provider, changes: ["connected"] }))
    .result.current

describe("the bell's account alert for an AI service (adr/0071 §3)", () => {
  afterEach(async () => {
    await i18next.changeLanguage("tr")
  })

  it("names every AI service by its shown name, never its id", async () => {
    const names = {
      deepseek: "DeepSeek",
      minimax: "MiniMax",
      gemini: "Gemini",
      photoroom: "Photoroom",
    }
    for (const lng of ["tr", "en"]) {
      await i18next.changeLanguage(lng)
      for (const [id, name] of Object.entries(names)) {
        const { title, link } = account(id)
        expect(title).toContain(name)
        expect(title).not.toContain(id)
        expect(link?.to).toBe("/settings/ai")
      }
    }
  })

  it("has a shown name for each service the panel knows", () => {
    for (const lng of ["tr", "en"]) {
      for (const id of AI_SERVICE_IDS) {
        expect(i18next.exists(`ai.services.${id}.name`, { lng })).toBe(true)
      }
    }
  })

  it("still shows a service the panel does not know yet, by its id", () => {
    expect(account("acme").title).toBe("acme hesap bilgileri değişti")
  })
})
