import { AI_FAKE_TARGET, AI_SERVICE_TARGETS, endpointUrl } from "@qticaret/types/control-plane"
import type { AiCapabilityTarget, AiServiceTarget } from "@qticaret/types/control-plane"
import { FAKE_SERVICE, aiServices } from "../registry/services"
import type { AiService, AiTarget } from "../registry/services"

/**
 * The registry's network targets are the shared table's (adr/0085 §2):
 * the control plane's gateway calls exactly where a shop's own key calls.
 * The addresses as they stood before the move are written out once more
 * here, so a change to the table is a change seen in this test too.
 */

const services = aiServices("production")

// Written out, not read from the table: a host added there must show here too
const HOSTS: Record<string, string[]> = {
  deepseek: ["api.deepseek.com"],
  minimax: ["api.minimax.io"],
  qwen: ["dashscope-intl.aliyuncs.com"],
  gemini: ["generativelanguage.googleapis.com"],
  photoroom: ["sdk.photoroom.com", "image-api.photoroom.com"],
  bria: ["engine.prod.bria-api.com"],
}

const AUTH_OF: Record<string, AiCapabilityTarget["auth"]> = {
  "openai-compatible": "bearer",
  photoroom: "x-api-key",
  "gemini-image": "x-goog-api-key",
  bria: "api_token",
}

function addressOf(target: AiTarget): string | null {
  if (target.connector === "openai-compatible") {
    return `${target.baseUrl}${target.path}`
  }
  return target.connector === "photoroom" ||
    target.connector === "gemini-image" ||
    target.connector === "bria"
    ? target.url
    : null
}

describe("the registry's targets come from the shared table", () => {
  it("lists the same networked services", () => {
    expect(services.map((service) => service.id).sort()).toEqual(
      Object.keys(AI_SERVICE_TARGETS).sort()
    )
  })

  it.each(services.map((service): [string, AiService] => [service.id, service]))(
    "%s: hosts, addresses, models and key headers agree",
    (id, service) => {
      const shared = (AI_SERVICE_TARGETS as Record<string, AiServiceTarget>)[id]
      expect(shared).toBeDefined()
      expect(HOSTS[id]).toBeDefined()
      expect([...service.hosts]).toEqual(HOSTS[id])
      expect([...(shared?.hosts ?? [])]).toEqual(HOSTS[id])
      const capabilities = Object.keys(service.capabilities)
      expect(capabilities.sort()).toEqual(Object.keys(shared?.capabilities ?? {}).sort())
      for (const capability of capabilities) {
        const target = service.capabilities[capability as keyof AiService["capabilities"]]
        const table = shared?.capabilities[capability as keyof AiServiceTarget["capabilities"]]
        expect(target && table).toBeTruthy()
        if (!target || !table) {
          continue
        }
        expect(target.model).toBe(table.model)
        expect(addressOf(target)).toBe(endpointUrl(table))
        expect(AUTH_OF[target.connector]).toBe(table.auth)
        const scene =
          target.connector === "photoroom" ||
          target.connector === "gemini-image" ||
          target.connector === "bria"
            ? target.scene
            : undefined
        expect(scene?.model).toBe(table.scene?.model)
        // Bria's body fields are the table's, the gateway's own (`fixedBody`)
        if (target.connector === "bria") {
          expect(target.body).toEqual(table.fixedBody)
          expect(scene?.body).toEqual(table.scene?.fixedBody)
        }
        expect(scene?.url).toBe(table.scene ? endpointUrl(table.scene) : undefined)
      }
    }
  )

  it("calls the addresses it called before the move", () => {
    const addresses = services.flatMap((service) =>
      Object.values(service.capabilities).flatMap((target) => {
        const own = addressOf(target) ?? "-"
        const scene =
          target.connector === "photoroom" ||
          target.connector === "gemini-image" ||
          target.connector === "bria"
            ? [target.scene?.url ?? "-"]
            : []
        return [`${service.id} ${target.model} ${own}`, ...scene.map((url) => `scene ${url}`)]
      })
    )
    expect(addresses).toEqual([
      "deepseek deepseek-flash https://api.deepseek.com/chat/completions",
      "deepseek deepseek-flash https://api.deepseek.com/chat/completions",
      "minimax MiniMax-M3.1-Flash https://api.minimax.io/v1/chat/completions",
      "minimax MiniMax-M3.1-Flash https://api.minimax.io/v1/chat/completions",
      "gemini gemini-4-hydrogen https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      "gemini gemini-4-hydrogen https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      "gemini gemini-nano-banana-2.1 https://generativelanguage.googleapis.com/v1/models/gemini-nano-banana-2.1:generateContent",
      "scene https://generativelanguage.googleapis.com/v1/models/gemini-nano-banana-2.1:generateContent",
      "photoroom segment-v1 https://sdk.photoroom.com/v1/segment",
      "scene https://image-api.photoroom.com/v2/edit",
      "qwen qwen3.8-flash https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
      "qwen qwen3.8-flash https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
      "bria RMBG2 https://engine.prod.bria-api.com/v2/image/edit/remove_background",
      "scene https://engine.prod.bria-api.com/v2/image/edit/replace_background",
    ])
  })

  it("names the fake service's models from the table, and lists it outside production only", () => {
    expect(FAKE_SERVICE.id).toBe(AI_FAKE_TARGET.id)
    expect(FAKE_SERVICE.capabilities.text?.model).toBe("fake-text")
    expect(FAKE_SERVICE.capabilities.vision?.model).toBe("fake-vision")
    expect(FAKE_SERVICE.capabilities.image_edit?.model).toBe("fake-image")
    expect(aiServices("test").map((service) => service.id)).toContain("fake")
    expect(services.map((service) => service.id)).not.toContain("fake")
  })
})
