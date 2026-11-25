import { describe, expect, it } from "vitest"
import {
  AI_CREDIT_CAPABILITIES,
  AI_FAKE_TARGET,
  AI_SERVICE_CHECKS,
  AI_SERVICE_TARGETS,
  AI_TARGET_AUTH_HEADERS,
  AI_TARGET_CAPABILITIES,
  aiServiceIdSchema,
  aiTargetModels,
  aiTargetServiceIds,
  aiTargetUncapped,
  endpointUrl,
} from "../../control-plane/index.js"
import type {
  AiCapabilityTarget,
  AiEndpointTarget,
  AiServiceTarget,
} from "../../control-plane/index.js"

const services: [string, AiServiceTarget][] = Object.entries(AI_SERVICE_TARGETS)

const endpointsOf = (target: AiCapabilityTarget): AiEndpointTarget[] =>
  target.scene ? [target, target.scene] : [target]

describe("AI service targets (adr/0085 §2)", () => {
  it("lists only capabilities the credits sell, every one of them on some service", () => {
    expect([...AI_TARGET_CAPABILITIES].sort()).toEqual([...AI_CREDIT_CAPABILITIES].sort())
    for (const capability of AI_TARGET_CAPABILITIES) {
      expect(services.some(([, service]) => service.capabilities[capability])).toBe(true)
    }
  })

  it.each(services)(
    "%s: a fixed https address on its own hosts, a path and a key header",
    (id, service) => {
      expect(aiServiceIdSchema.safeParse(id).success).toBe(true)
      expect(service.hosts.length).toBeGreaterThan(0)
      const targets: [string, AiCapabilityTarget][] = Object.entries(service.capabilities)
      expect(targets.length).toBeGreaterThan(0)
      for (const [capability, target] of targets) {
        expect(AI_TARGET_CAPABILITIES).toContain(capability)
        expect(AI_TARGET_AUTH_HEADERS).toContain(target.auth)
        expect(target.protocol === "openai-chat").toBe(target.auth === "bearer")
        expect(target.scene === undefined || capability === "image_edit").toBe(true)
        for (const endpoint of endpointsOf(target)) {
          expect(endpoint.model).toMatch(/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/)
          expect(endpoint.baseUrl).toMatch(/^https:\/\/[a-z0-9.-]+(?:\/[A-Za-z0-9._-]+)*$/)
          expect(endpoint.path).toMatch(/^\/[A-Za-z0-9._:/-]+$/)
          const url = new URL(endpointUrl(endpoint))
          expect(url.protocol).toBe("https:")
          expect(url.port).toBe("")
          expect(url.username + url.password + url.search + url.hash).toBe("")
          expect(service.hosts).toContain(url.hostname)
          // What was written is what is called: no normalisation hides a difference
          expect(url.href).toBe(endpointUrl(endpoint))
        }
      }
    }
  )

  it("calls Qwen on Singapore's shared domain alone, thinking off, the output capped", () => {
    // The "International" scope: no mainland node; neither a workspace domain nor "Global"
    expect(AI_SERVICE_TARGETS.qwen.hosts).toEqual(["dashscope-intl.aliyuncs.com"])
    for (const target of Object.values<AiCapabilityTarget>(AI_SERVICE_TARGETS.qwen.capabilities)) {
      expect(endpointUrl(target)).toBe(
        "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions"
      )
      expect(target.fixedBody).toEqual({ enable_thinking: false })
      expect(target.maxTokensField).toBe("max_completion_tokens")
    }
    expect(aiTargetUncapped("qwen", "text")).toBe(false)
    expect(aiTargetUncapped("qwen", "vision")).toBe(false)
  })

  it("is frozen", () => {
    expect(Object.isFrozen(AI_SERVICE_TARGETS)).toBe(true)
    expect(Object.isFrozen(AI_FAKE_TARGET)).toBe(true)
    expect(Object.isFrozen(AI_SERVICE_CHECKS)).toBe(true)
  })

  it.each(services)("%s: an output budget field on a chat target, a price", (_, service) => {
    for (const target of Object.values<AiCapabilityTarget>(service.capabilities)) {
      expect(target.maxTokensField !== undefined).toBe(target.protocol === "openai-chat")
      for (const endpoint of endpointsOf(target)) {
        const price = endpoint.price ?? target.price
        expect(price?.currency).toBe("USD")
        for (const value of Object.values(price ?? {})) {
          expect(typeof value === "string" || (Number.isSafeInteger(value) && value > 0)).toBe(true)
        }
      }
    }
  })

  it.each(services)("%s: a connection check on its own hosts, https, no query", (id, service) => {
    const check = (AI_SERVICE_CHECKS as Record<string, { url: string }>)[id]
    const url = new URL(check?.url ?? "http://missing")
    expect(url.protocol).toBe("https:")
    expect(url.search + url.hash + url.username + url.port).toBe("")
    expect(service.hosts).toContain(url.hostname)
  })

  it("lists the fake service in test and development only", () => {
    expect(aiTargetServiceIds("test")).toContain("fake")
    expect(aiTargetServiceIds("development")).toContain("fake")
    for (const env of ["production", "staging", undefined]) {
      expect(aiTargetServiceIds(env)).not.toContain("fake")
      expect(aiTargetModels("fake", "text", env)).toBeNull()
    }
    expect(aiTargetModels("fake", "text", "test")).toEqual(["fake-text"])
  })

  it("answers the models a capability may be routed to, null where it has none", () => {
    expect(aiTargetModels("deepseek", "text", "production")).toEqual(["deepseek-flash"])
    expect(aiTargetModels("photoroom", "image_edit", "production")).toEqual(["segment-v1"])
    expect(aiTargetModels("qwen", "vision", "production")).toEqual(["qwen3.8-flash"])
    expect(aiTargetModels("qwen", "image_edit", "production")).toBeNull()
    expect(aiTargetModels("photoroom", "text", "production")).toBeNull()
    expect(aiTargetModels("deepseek", "video", "production")).toBeNull()
    expect(aiTargetModels("openai", "text", "production")).toBeNull()
    expect(aiTargetModels("toString", "text", "production")).toBeNull()
    expect(aiTargetModels("__proto__", "text", "production")).toBeNull()
  })
})

describe("the target tables are frozen all the way down (PR #371 D5)", () => {
  const unfrozen = (value: unknown, path: string): string[] =>
    typeof value !== "object" || value === null
      ? []
      : [
          ...(Object.isFrozen(value) ? [] : [path]),
          ...Object.entries(value).flatMap(([key, child]) => unfrozen(child, `${path}.${key}`)),
        ]

  it("leaves no object or list open to change", () => {
    expect(unfrozen(AI_SERVICE_TARGETS, "targets")).toEqual([])
    expect(unfrozen(AI_SERVICE_CHECKS, "checks")).toEqual([])
    expect(unfrozen(AI_FAKE_TARGET, "fake")).toEqual([])
    const hosts = AI_SERVICE_TARGETS.deepseek.hosts as unknown as string[]
    expect(() => hosts.push("evil.example.com")).toThrow(TypeError)
    expect(AI_SERVICE_TARGETS.deepseek.hosts).toEqual(["api.deepseek.com"])
  })
})
