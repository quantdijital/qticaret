import { SERVER_ERROR_MESSAGES_EN, SERVER_ERROR_MESSAGES_TR } from "../../errors/messages"
import { CREDENTIAL_PROVIDERS } from "../../../modules/integration-credentials/providers"
import { AI_ERROR_KEYS } from "../errors"
import { AI_CAPABILITIES } from "../registry/capabilities"
import { FAKE_SERVICE, aiServices, findAiService } from "../registry/services"
import type { AiService } from "../registry/services"
import {
  IMAGE_BACKGROUND_TASK,
  IMAGE_SCENE_TASK,
  MAX_PURPOSE_OPTIONS,
  MAX_TASK_OPTIONS,
  TEST_TASK,
  aiTasks,
  findAiTask,
} from "../registry/tasks"
import { alternativesTo, canRunTask, chooseService, usableServices } from "../select"
import type { AiConnection } from "../select"

const connected = (...providers: string[]): AiConnection[] =>
  providers.map((provider) => ({ provider, status: "connected" }))

const OWN_KEYS = { ownKeys: true }

describe("AI registries (adr/0071 §2)", () => {
  it("lists the fake service in tests and development only", () => {
    expect(aiServices("test").map((each) => each.id)).toContain("fake")
    expect(aiServices("development").map((each) => each.id)).toContain("fake")
    for (const env of ["production", "staging"]) {
      expect(aiServices(env).map((each) => each.id)).toEqual([
        "deepseek",
        "minimax",
        "gemini",
        "photoroom",
        "bria",
      ])
      expect(findAiService("fake", env)).toBeNull()
    }
  })

  it("keeps the test task out of every environment but tests", () => {
    expect(aiTasks("test")).toContain(TEST_TASK)
    expect(aiTasks("production").map((task) => task.id)).toEqual([
      "seo_title",
      "seo_description",
      "product_description",
      "category_description",
      "collection_description",
      "brand_description",
      "image_alt_text",
      "image_background",
      "review_summary",
      "review_reply",
      "question_answer",
      "product_from_photo",
      "image_scene",
      "focus_keyword",
      "product_title",
      "short_description",
      "product_tags",
      "product_category",
      "product_attributes",
      "product_faq",
      "campaign_email",
      "campaign_sms",
      "post_draft",
    ])
    expect(findAiTask("test_text", "development")).toBeNull()
  })

  it("gives every task a known capability, two options at most (a purpose list four) and a role", () => {
    for (const task of aiTasks("test")) {
      expect(AI_CAPABILITIES).toContain(task.capability)
      expect(task.options.length).toBeLessThanOrEqual(
        task.optionKind === "purpose" ? MAX_PURPOSE_OPTIONS : MAX_TASK_OPTIONS
      )
      expect(task.roles.length).toBeGreaterThan(0)
      expect(Number.isSafeInteger(task.credits) && task.credits >= 0).toBe(true)
    }
  })

  it("has unique service ids, each with a known capability set", () => {
    const ids = aiServices("test").map((each) => each.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const service of aiServices("test")) {
      expect(Object.keys(service.capabilities).length).toBeGreaterThan(0)
      for (const capability of Object.keys(service.capabilities)) {
        expect(AI_CAPABILITIES).toContain(capability)
      }
      expect(service.dataNoteKey).toMatch(/^ai\.data_note\.[a-z_]+$/)
    }
  })

  it("sends every real service to a fixed https address on its own host list", () => {
    for (const service of aiServices("production")) {
      expect(service.hosts.length).toBeGreaterThan(0)
      for (const [capability, target] of Object.entries(service.capabilities)) {
        expect(["openai-compatible", "photoroom", "gemini-image", "bria"]).toContain(
          target.connector
        )
        if (target.connector !== "openai-compatible") {
          if (
            target.connector === "photoroom" ||
            target.connector === "gemini-image" ||
            target.connector === "bria"
          ) {
            const image = new URL(target.url)
            expect(image.protocol).toBe("https:")
            expect(service.hosts).toContain(image.hostname)
            expect(image.search).toBe("")
            expect(target.backgrounds.length).toBeGreaterThan(0)
            if (target.scene) {
              // A scene endpoint is held to the same host list, and marks its result
              const scene = new URL(target.scene.url)
              expect(scene.protocol).toBe("https:")
              expect(service.hosts).toContain(scene.hostname)
              expect(scene.search + scene.username + scene.password).toBe("")
              expect(["edited", "generated"]).toContain(target.scene.source)
            }
          }
          continue
        }
        const url = new URL(`${target.baseUrl}${target.path}`)
        expect(url.protocol).toBe("https:")
        expect(service.hosts).toContain(url.hostname)
        expect(url.search).toBe("")
        expect(url.username + url.password).toBe("")
        expect(target.model).not.toBe("")
        // A capability that is offered has a price to estimate from
        expect(service.unitPrices[capability as keyof AiService["unitPrices"]]).toBeDefined()
      }
      for (const key of Object.values(service.bodyErrors ?? {})) {
        expect(AI_ERROR_KEYS).toContain(key)
      }
    }
  })

  it("registers only what has a connector: text, image reading, image editing", () => {
    const offered = Object.fromEntries(
      aiServices("production").map((service) => [service.id, Object.keys(service.capabilities)])
    )
    expect(offered).toEqual({
      deepseek: ["text", "vision"],
      minimax: ["text", "vision"],
      gemini: ["text", "vision", "image_edit"],
      photoroom: ["image_edit"],
      bria: ["image_edit"],
    })
    // A result is fetched by its address from Bria alone, from its documented host only;
    // the others answer with the bytes
    for (const service of aiServices("production")) {
      expect([service.id, service.downloadHosts]).toEqual([
        service.id,
        service.id === "bria" ? ["engine.prod.bria-api.com"] : [],
      ])
    }
  })

  it("registers text and image reading for every text service, image reading on the text endpoint", () => {
    // An image-only service (Photoroom) has neither
    const textServices = aiServices("production").filter((service) => service.capabilities.text)
    expect(textServices.length).toBeGreaterThan(0)
    for (const service of textServices) {
      expect(Object.keys(service.capabilities)).toEqual(expect.arrayContaining(["text", "vision"]))
      const { text, vision } = service.capabilities
      // Image reading is the text endpoint with images: same connector, host and path, a size cap
      expect(vision).toMatchObject({
        connector: "openai-compatible",
        baseUrl: text && "baseUrl" in text ? text.baseUrl : "",
        path: "/chat/completions",
        imageInput: { maxBytes: expect.any(Number) as number },
      })
      expect(service.unitPrices.vision).toBeDefined()
    }
    // A text target never takes an image
    for (const service of textServices) {
      expect(service.capabilities.text).not.toHaveProperty("imageInput")
    }
  })

  it("does not claim a credential provider that is not the service's own name", () => {
    for (const service of aiServices("test")) {
      expect(service.credentialProvider).toBe(service.id)
    }
    // PR 0b-2: each service is connected as a credential provider of its own name, a key alone
    for (const service of aiServices("test")) {
      expect(CREDENTIAL_PROVIDERS).toHaveProperty(service.credentialProvider)
      expect(
        CREDENTIAL_PROVIDERS[service.credentialProvider as keyof typeof CREDENTIAL_PROVIDERS]
          .secrets
      ).toEqual(["api_key"])
    }
  })

  it("has a sentence in both languages for every AI error key", () => {
    for (const key of AI_ERROR_KEYS) {
      expect(SERVER_ERROR_MESSAGES_TR[key]).toEqual(expect.any(String))
      expect(SERVER_ERROR_MESSAGES_EN[key]).toEqual(expect.any(String))
    }
  })
})

describe("service selection (adr/0071 §4)", () => {
  const services = aiServices("test")
  const usable = (connections: AiConnection[], flags = OWN_KEYS) =>
    usableServices(TEST_TASK, connections, flags, services)

  it("has no service when nothing is connected", () => {
    expect(usable([])).toEqual([])
    expect(chooseService({ task: TEST_TASK, usable: [] })).toEqual({
      ok: false,
      error: "ai.no_service",
      alternatives: [],
    })
  })

  it("counts only connected and verified accounts", () => {
    const connections: AiConnection[] = [
      { provider: "deepseek", status: "unverified" },
      { provider: "minimax", status: "rejected" },
      { provider: "gemini", status: "unreadable" },
    ]
    expect(usable(connections)).toEqual([])
  })

  it("leaves out a service without the task's capability", () => {
    const video = { ...TEST_TASK, capability: "video" as const }
    expect(usableServices(video, connected("deepseek", "fake"), OWN_KEYS, services)).toEqual([])
  })

  it("offers a scene only on a service with a scene endpoint", () => {
    const gemini = findAiService("gemini", "production")
    const photoroom = findAiService("photoroom", "production")
    expect(gemini && canRunTask(gemini, IMAGE_SCENE_TASK)).toBe(true)
    expect(photoroom && canRunTask(photoroom, IMAGE_SCENE_TASK)).toBe(true)
    const bria = findAiService("bria", "production")
    expect(bria && canRunTask(bria, IMAGE_SCENE_TASK)).toBe(true)
    const all = aiServices("test")
    const ids = (list: AiService[]) => list.map((each) => each.id)
    expect(
      ids(usableServices(IMAGE_SCENE_TASK, connected("deepseek", "gemini"), OWN_KEYS, all))
    ).toEqual(["gemini"])
    // An image editor without a scene endpoint does backgrounds, never a scene
    const plain: AiService = {
      ...FAKE_SERVICE,
      id: "plain",
      credentialProvider: "plain",
      capabilities: {
        image_edit: { connector: "fake-image", model: "x", backgrounds: ["white"] },
      },
    }
    expect(ids(usableServices(IMAGE_SCENE_TASK, connected("plain"), OWN_KEYS, [plain]))).toEqual([])
    expect(
      ids(usableServices(IMAGE_BACKGROUND_TASK, connected("plain"), OWN_KEYS, [plain]))
    ).toEqual(["plain"])
  })

  it("uses no own-key service while the plan closes own keys", () => {
    expect(usable(connected("deepseek", "gemini"), { ownKeys: false })).toEqual([])
    const platform: AiService = { ...FAKE_SERVICE, id: "platform", funding: "platform_credit" }
    const withPlatform = [...services, { ...platform, credentialProvider: "platform" }]
    // A task the credits price (adr/0085 K4): the key test is not one
    const priced = findAiTask("seo_title", "test")
    if (!priced) {
      throw new Error("no seo_title task")
    }
    const open = (flags: { ownKeys: boolean; platformCredits?: boolean }) =>
      usableServices(priced, connected("deepseek", "platform"), flags, withPlatform).map(
        (each) => each.id
      )
    expect(open({ ownKeys: false, platformCredits: true })).toEqual(["platform"])
    expect(open({ ownKeys: true })).toEqual(["deepseek"])
  })

  it("takes the only usable service, whatever was asked for", () => {
    const only = usable(connected("minimax"))
    const choice = chooseService({ task: TEST_TASK, usable: only, requested: "gemini" })
    expect(choice).toMatchObject({ ok: true, service: { id: "minimax" }, alternatives: [] })
  })

  it("takes the requested one among several, in registry order otherwise", () => {
    const several = usable(connected("gemini", "deepseek", "minimax"))
    expect(several.map((each) => each.id)).toEqual(["deepseek", "minimax", "gemini"])

    expect(chooseService({ task: TEST_TASK, usable: several, requested: "gemini" })).toMatchObject({
      ok: true,
      service: { id: "gemini" },
      alternatives: ["deepseek", "minimax"],
    })
    expect(chooseService({ task: TEST_TASK, usable: several })).toMatchObject({
      ok: true,
      service: { id: "deepseek" },
    })
  })

  it("refuses a requested service that is not usable, and names the ones that are", () => {
    const several = usable(connected("deepseek", "minimax"))
    expect(chooseService({ task: TEST_TASK, usable: several, requested: "gemini" })).toEqual({
      ok: false,
      error: "ai.service_unavailable",
      alternatives: ["deepseek", "minimax"],
    })
  })

  it("remembers the preference, and falls back when it is no longer usable", () => {
    const several = usable(connected("deepseek", "minimax"))
    expect(
      chooseService({ task: TEST_TASK, usable: several, preference: "minimax" })
    ).toMatchObject({ ok: true, service: { id: "minimax" } })
    expect(chooseService({ task: TEST_TASK, usable: several, preference: "gemini" })).toMatchObject(
      { ok: true, service: { id: "deepseek" } }
    )
    // What was asked now wins over what was chosen before
    expect(
      chooseService({
        task: TEST_TASK,
        usable: several,
        requested: "deepseek",
        preference: "minimax",
      })
    ).toMatchObject({ ok: true, service: { id: "deepseek" } })
  })

  it("lists the others after a failed call, and never picks one by itself", () => {
    const several = usable(connected("deepseek", "minimax", "gemini"))
    expect(alternativesTo(several, "minimax")).toEqual(["deepseek", "gemini"])
  })
})
