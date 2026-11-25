import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import sharp from "sharp"
import { resetAiBreakers } from "../../src/lib/ai/breaker"
import { forgetProcessCaches } from "../../src/lib/cache/process-caches"
import { MEDIA_MODULE } from "../../src/modules/media"
import type MediaModuleService from "../../src/modules/media/service"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import { AI_ASSISTANT, AI_PLATFORM_CREDITS } from "../../src/modules/platform-settings/features"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { createAdminUser } from "../helpers/admin"
import { aiProduct, askFor, pushPlan } from "../helpers/ai"
import { availableStatus, chatAnswer, fakeAiGateway, refusalAnswer } from "../helpers/ai-gateway"
import type { GatewayAnswer } from "../helpers/ai-gateway"
import { listen, managedForThisFile } from "../helpers/control-plane"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(240 * 1000)

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

interface Job {
  id: string
  status: string
  result_summary: {
    done: { media_id: string; result_id: string }[]
    failed: { media_id: string; key: string }[]
  } | null
}

const picture = (r: number) =>
  sharp({ create: { width: 64, height: 48, channels: 3, background: { r, g: 90, b: 160 } } })
    .png()
    .toBuffer()

/** Gemini's answer to an image edit, passed on by the gateway with its charge. */
const geminiImageAnswer = async (): Promise<GatewayAnswer> => ({
  status: 200,
  headers: {
    "content-type": "application/json",
    "x-qt-ai-credits-charged": "10",
    "x-qt-ai-credits-balance": "30",
  },
  body: JSON.stringify({
    candidates: [
      {
        content: {
          parts: [
            {
              inlineData: { mimeType: "image/png", data: (await picture(250)).toString("base64") },
            },
          ],
        },
        finishReason: "STOP",
      },
    ],
    usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 1290 },
  }),
})

/**
 * The security review of P4b-1, the tests it found missing: on the
 * platform's credits a timeout is never sent twice, an image edit goes
 * signed to the gateway with no provider credential, and each assistant
 * turn is an operation of its own.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const ask = askFor(http)
    const gateway = fakeAiGateway()
    const media = () => getContainer().resolve<MediaModuleService>(MEDIA_MODULE)
    let owner: { headers: Record<string, string> }

    managedForThisFile()

    beforeAll(async () => {
      process.env["CONTROL_PLANE_URL"] = await listen(gateway.server)
    })

    afterAll(() => {
      gateway.server.close()
    })

    beforeEach(async () => {
      forgetProcessCaches()
      resetAiBreakers()
      gateway.calls.length = 0
      gateway.state.answers = []
      gateway.state.status = availableStatus()
      await pushPlan(http, true, {}, { [AI_PLATFORM_CREDITS]: true })
      owner = await createAdminUser(http, getContainer())
    })

    it.each([
      ["the gateway's provider_timeout", refusalAnswer("provider_timeout")],
      ["a bare 504", { status: 504, headers: {}, body: "{}" }],
    ] as [string, GatewayAnswer][])("never sends a call again after %s", async (_case, answer) => {
      gateway.state.answers = [answer, answer]
      const failed = await ask(owner.headers, {
        task: "seo_title",
        entity_type: "product",
        entity_id: await aiProduct(getContainer()),
      })
      expect(failed.status).toBeGreaterThanOrEqual(400)
      expect(gateway.calls).toHaveLength(1)
    })

    it("sends an image edit signed to the gateway, with no provider credential", async () => {
      gateway.state.status = availableStatus({ text: "deepseek", image_edit: "gemini" })
      gateway.state.answers = [await geminiImageAnswer()]
      const form = new FormData()
      form.append(
        "files",
        new Blob([new Uint8Array(await picture(40))], { type: "image/png" }),
        "vazo.png"
      )
      const uploaded = await http.post<{ files: { id: string }[] }>("/admin/uploads", form, {
        headers: owner.headers,
      })
      const registered = await http.post<{ media: { id: string }[] }>(
        "/admin/media",
        { file_ids: uploaded.data.files.map((file) => file.id), library: true },
        { headers: owner.headers }
      )
      const originalId = registered.data.media[0]?.id ?? "none"

      const asked = await settle(
        http.post<{ job_id: string; service: string }>(
          "/admin/ai/suggestions",
          {
            task: "image_background",
            entity_type: "media",
            entity_ids: [originalId],
            option: "white",
          },
          { headers: owner.headers }
        )
      )
      expect([asked.status, asked.data.service]).toEqual([202, "platform"])
      let job: Job | undefined
      for (let attempt = 0; attempt < 480 && !job; attempt++) {
        const { data } = await http.get<{ async_job: Job }>(
          `/admin/async-jobs/${asked.data.job_id}`,
          {
            headers: owner.headers,
          }
        )
        if (data.async_job.status !== "queued" && data.async_job.status !== "running") {
          job = data.async_job
        }
        await new Promise((resolve) => setTimeout(resolve, 250))
      }
      expect(job?.status).toBe("succeeded")
      expect(job?.result_summary?.failed).toEqual([])
      const [copy] = await media().listMediaAssets({ derived_from_id: originalId })
      expect(copy).toMatchObject({ ai_source: "edited" })

      expect(gateway.calls).toHaveLength(1)
      const [call] = gateway.calls
      expect(call?.signed).toBe(true)
      expect(call?.query.get("task")).toBe("image_background")
      expect(call?.query.get("capability")).toBe("image_edit")
      expect(call?.query.get("service")).toBe("gemini")
      expect(call?.query.get("operation")).toMatch(UUID)
      expect(call?.headers["content-type"]).toMatch(/^application\/json/)
      expect(call?.body).toContain("inline_data")
      for (const name of ["authorization", "x-api-key", "x-goog-api-key"]) {
        expect(call?.headers[name]).toBeUndefined()
      }
    })

    it("gives each assistant turn an operation of its own", async () => {
      await getContainer()
        .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
        .setFeature(AI_ASSISTANT, true, null)
      gateway.state.answers = [chatAnswer("Ayarlar > Kargo.", 0), chatAnswer("Ayarlar > Ödeme.", 0)]
      for (const message of ["kargo ücreti nereden değişir", "ödeme yöntemi nereden eklenir"]) {
        const turn = await settle(
          http.post("/admin/ai/assistant/turns", { message }, { headers: owner.headers })
        )
        expect(turn.status).toBe(200)
      }
      const operations = gateway.calls.map((each) => each.query.get("operation"))
      expect(operations).toHaveLength(2)
      expect(operations[0]).toMatch(UUID)
      expect(operations[1]).toMatch(UUID)
      expect(operations[1]).not.toBe(operations[0])
    })
  },
})
