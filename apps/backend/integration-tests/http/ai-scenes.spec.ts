import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakeSecret } from "@qticaret/testing"
import sharp from "sharp"
import { resetAiBreakers } from "../../src/lib/ai/breaker"
import { AI_MODULE } from "../../src/modules/ai"
import type AiModuleService from "../../src/modules/ai/service"
import { createAdminUser } from "../helpers/admin"
import { askFor, connectFake, pushPlan, storedRunsWith } from "../helpers/ai"
import { managedForThisFile } from "../helpers/control-plane"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(180 * 1000)

interface SceneView {
  code: string
  name: { tr: string; en: string }
  own: boolean
}

interface Saved {
  values: { show_pack_scenes: boolean; scenes: { id: string; name: string; prompt: string }[] }
}

/**
 * Aşama 7 (docs/22; adr/0071 Ek 2026-11-19): the shop's own scenes and a
 * scene typed once, on the fake service only (nothing leaves the
 * machine). Saved scenes are the `ai_scenes` settings section: owner and
 * admin write it; they come before the packs' and the packs' can be
 * hidden. A typed scene is held on the server; a code that is not this
 * shop's, and a text that does not pass, queue nothing.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let owner: { headers: Record<string, string>; userId: string }
    const key = `test-key-${fakeSecret()}`
    const ask = askFor(http)
    const usages = () => getContainer().resolve<AiModuleService>(AI_MODULE).listAiUsages({})

    managedForThisFile()

    async function upload(): Promise<string> {
      const bytes = await sharp({
        create: { width: 64, height: 48, channels: 3, background: { r: 40, g: 90, b: 160 } },
      })
        .png()
        .toBuffer()
      const form = new FormData()
      form.append("files", new Blob([new Uint8Array(bytes)], { type: "image/png" }), "vazo.png")
      const { data } = await http.post<{ files: { id: string }[] }>("/admin/uploads", form, {
        headers: owner.headers,
      })
      const registered = await http.post<{ media: { id: string }[] }>(
        "/admin/media",
        { file_ids: data.files.map((file) => file.id), library: true },
        { headers: owner.headers }
      )
      return registered.data.media[0]?.id ?? "none"
    }

    const saveScenes = (headers: Record<string, string>, body: Record<string, unknown>) =>
      settle(http.post<Saved>("/admin/platform-settings/ai_scenes", body, { headers }))

    async function sceneView(): Promise<SceneView[]> {
      const { data } = await http.get<{ tasks: { id: string; scenes?: SceneView[] }[] }>(
        "/admin/ai/services",
        { headers: owner.headers }
      )
      return data.tasks.find((each) => each.id === "image_scene")?.scenes ?? []
    }

    async function settled(id: string): Promise<{ status: string; result_summary: unknown }> {
      for (let attempt = 0; attempt < 480; attempt++) {
        const { data } = await http.get<{
          async_job: { status: string; result_summary: unknown }
        }>(`/admin/async-jobs/${id}`, { headers: owner.headers })
        if (data.async_job.status !== "queued" && data.async_job.status !== "running") {
          return data.async_job
        }
        await new Promise((resolve) => setTimeout(resolve, 250))
      }
      throw new Error("job did not finish")
    }

    beforeEach(async () => {
      resetAiBreakers()
      await pushPlan(http, true)
      owner = await createAdminUser(http, getContainer())
      await connectFake(http, owner.headers, key)
    })

    it("saves the shop's scenes for owner and admin only, first in the list, packs hideable", async () => {
      const operations = await createAdminUser(http, getContainer(), "operations")
      const admin = await createAdminUser(http, getContainer(), "admin")
      const body = { scenes: [{ prompt: "pembe battaniye üstünde, yumuşak gün ışığı" }] }

      expect((await saveScenes(operations.headers, body)).status).toBe(403)
      const saved = await saveScenes(admin.headers, body)
      expect(saved.status).toBe(200)
      const [scene] = saved.data.values.scenes
      expect(scene?.id).toMatch(/^own_[a-z0-9]{8,24}$/)
      expect(scene?.name).toBe("pembe battaniye üstünde, yumuşak")

      // Its own first, then the general pack's; never a prompt in the view
      const view = await sceneView()
      expect(view.map((each) => [each.code, each.own])).toEqual([
        [scene?.id, true],
        ["studio_table", false],
        ["daylight_surface", false],
      ])
      expect(JSON.stringify(view)).not.toContain("gün ışığı")

      await saveScenes(owner.headers, { show_pack_scenes: false })
      expect((await sceneView()).map((each) => each.code)).toEqual([scene?.id])
    })

    it("refuses a thirteenth scene, a link and markup, and keeps personal data out", async () => {
      const twelve = Array.from({ length: 12 }, (_, i) => ({ prompt: `taş zemin ${String(i)}` }))
      const full = await saveScenes(owner.headers, { scenes: [...twelve, { prompt: "bir tane" }] })
      expect([full.status, (full.data as unknown as { message: string }).message]).toEqual([
        400,
        "ai.scenes_full",
      ])
      for (const prompt of ["https://example.com", "<b>masa</b>", "x".repeat(201)]) {
        expect((await saveScenes(owner.headers, { scenes: [{ prompt }] })).status).toBe(400)
      }
      const redacted = await saveScenes(owner.headers, {
        scenes: [{ name: "Ara", prompt: "masa üstü, ara 0532 123 45 67" }],
      })
      expect(redacted.data.values.scenes[0]?.prompt).toBe("masa üstü, ara …")
    })

    it("sets a picture in a saved scene and in one typed once; refuses what is not the shop's", async () => {
      const saved = await saveScenes(owner.headers, { scenes: [{ prompt: "taş zemin" }] })
      const savedId = saved.data.values.scenes[0]?.id ?? "none"
      const pictureId = await upload()
      const base = {
        task: "image_scene",
        entity_type: "media",
        entity_ids: [pictureId],
        service: "fake",
      }

      // Unknown or another shape: 400, nothing claimed or called
      for (const option of ["made_up_scene", "own_zzzzzzzzzz"]) {
        const refused = await ask(owner.headers, { ...base, option })
        expect([refused.status, refused.data.message]).toEqual([400, "ai.unknown_task"])
      }
      const link = await ask(owner.headers, { ...base, prompt: "see https://example.com" })
      expect([link.status, link.data.message]).toEqual([400, "ai.scene_text_invalid"])
      expect(await usages()).toEqual([])

      for (const body of [
        { ...base, option: savedId },
        { ...base, prompt: "pembe battaniye üstünde, ara 0532 123 45 67" },
      ]) {
        const asked = await settle(
          http.post<{ job_id: string }>("/admin/ai/suggestions", body, { headers: owner.headers })
        )
        expect(asked.status).toBe(202)
        const job = await settled(asked.data.job_id)
        expect(job.status).toBe("succeeded")
        expect(JSON.stringify(job.result_summary)).not.toContain("battaniye")
      }
      const rows = await usages()
      expect(rows).toHaveLength(2)
      expect(rows.every((row) => row.task === "image_scene" && row.status === "succeeded")).toBe(
        true
      )
      // The phone typed in the scene was taken out before anything was stored
      expect(await storedRunsWith(getContainer(), "0532 123 45 67")).toBe(0)
    })
  },
})
