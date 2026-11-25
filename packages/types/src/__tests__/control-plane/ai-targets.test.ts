import { describe, expect, it } from "vitest"
import {
  AI_CREDIT_CAPABILITIES,
  AI_FAKE_TARGET,
  AI_SERVICE_TARGETS,
  AI_TARGET_AUTH_HEADERS,
  AI_TARGET_CAPABILITIES,
  aiServiceIdSchema,
  aiTargetModels,
  aiTargetServiceIds,
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

  it("is frozen", () => {
    expect(Object.isFrozen(AI_SERVICE_TARGETS)).toBe(true)
    expect(Object.isFrozen(AI_FAKE_TARGET)).toBe(true)
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
    expect(aiTargetModels("photoroom", "text", "production")).toBeNull()
    expect(aiTargetModels("deepseek", "video", "production")).toBeNull()
    expect(aiTargetModels("openai", "text", "production")).toBeNull()
    expect(aiTargetModels("toString", "text", "production")).toBeNull()
    expect(aiTargetModels("__proto__", "text", "production")).toBeNull()
  })
})
