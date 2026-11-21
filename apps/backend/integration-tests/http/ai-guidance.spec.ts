import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { guidanceFor } from "../../src/lib/ai/guidance"
import { createAdminUser } from "../helpers/admin"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(180 * 1000)

interface Saved {
  values: {
    tone: string
    address: string
    audience: string | null
    guide: string | null
    prefer: string[]
    avoid: string[]
    tasks: Record<string, { extra: string | null; examples: string[] }>
  }
}

/**
 * The shop's writing guidance (adr/0074 §2): the `ai_guidance` settings
 * section through the platform settings route. Owner and admin write it,
 * every role reads it; a save is in the audit log (adr/0011); what is
 * typed is held as plain text with personal data taken out, and only the
 * registry's text tasks take guidance of their own.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const path = "/admin/platform-settings/ai_guidance"
    const save = (headers: Record<string, string>, body: Record<string, unknown>) =>
      settle(http.post<Saved>(path, body, { headers }))
    const messageOf = (answer: { data: unknown }) => (answer.data as { message?: string }).message

    it("is written by owner and admin only, read by every role, and audited", async () => {
      const owner = await createAdminUser(http, getContainer())
      const admin = await createAdminUser(http, getContainer(), "admin")
      const operations = await createAdminUser(http, getContainer(), "operations")
      const readonly = await createAdminUser(http, getContainer(), "readonly")

      const first = await settle(http.get<Saved>(path, { headers: readonly.headers }))
      expect(first.status).toBe(200)
      expect(first.data.values).toMatchObject({ tone: "warm", address: "siz", tasks: {} })

      expect((await save(operations.headers, { tone: "plain" })).status).toBe(403)
      expect((await save(readonly.headers, { tone: "plain" })).status).toBe(403)
      const byAdmin = await save(admin.headers, {
        tone: "expert",
        audience: "ev aşçıları ve kamp severler",
        prefer: ["el yapımı"],
        tasks: { seo_title: { extra: "Marka adını sona koy" } },
      })
      expect(byAdmin.status).toBe(200)
      const byOwner = await save(owner.headers, {
        address: "sen",
        tasks: { seo_description: { examples: ["Kısa ve net bir örnek."] } },
      })
      expect(byOwner.status).toBe(200)
      // One level merged: the admin's task note stays beside the owner's examples
      expect(byOwner.data.values).toMatchObject({
        tone: "expert",
        address: "sen",
        prefer: ["el yapımı"],
        tasks: {
          seo_title: { extra: "Marka adını sona koy", examples: [] },
          seo_description: { extra: null, examples: ["Kısa ve net bir örnek."] },
        },
      })

      // Sent empty, a task's guidance is empty; shorter lists replace the stored ones
      await save(owner.headers, {
        prefer: ["el yapımı", "dayanıklı"],
        tasks: { seo_description: { examples: ["Bir", "İki"] } },
      })
      const cleared = await save(owner.headers, {
        prefer: ["dayanıklı"],
        tasks: { seo_title: { extra: "" }, seo_description: { examples: ["İki"] } },
      })
      expect(cleared.data.values.prefer).toEqual(["dayanıklı"])
      expect(cleared.data.values.tasks).toEqual({
        seo_title: { extra: null, examples: [] },
        seo_description: { extra: null, examples: ["İki"] },
      })
      expect(await guidanceFor(getContainer(), "seo_title")).not.toContain("Marka adını")

      const read = await settle(http.get<Saved>(path, { headers: operations.headers }))
      expect(read.data.values.address).toBe("sen")

      const audit = await eventually(
        () =>
          http.get<{ audit_entries: { resource_id: string | null; outcome: number }[] }>(
            "/admin/audit-log?resource_type=platform_settings&kind=mutation&limit=100",
            { headers: owner.headers }
          ),
        (answer) =>
          answer.data.audit_entries.filter(
            (entry) => entry.resource_id === "ai_guidance" && entry.outcome === 200
          ).length >= 4
      )
      expect(
        audit.data.audit_entries.filter(
          (entry) => entry.resource_id === "ai_guidance" && entry.outcome === 200
        )
      ).toHaveLength(4)

      // What a task's system message gets from it
      const text = await guidanceFor(getContainer(), "seo_description")
      expect(text).toContain("Mağazanın yazım yönergesi:")
      expect(text).toContain("İki")
    })

    it("refuses what is over a limit and an unknown task, and keeps personal data out", async () => {
      const owner = await createAdminUser(http, getContainer())
      const refusals: [Record<string, unknown>, string][] = [
        [{ audience: "a".repeat(161) }, "ai.guidance_too_long"],
        [{ guide: "a".repeat(1501) }, "ai.guidance_too_long"],
        [
          { avoid: Array.from({ length: 21 }, (_, i) => `s${String(i)}`) },
          "ai.guidance_words_full",
        ],
        [{ tasks: { seo_title: { examples: ["a", "b", "c", "d"] } } }, "ai.guidance_examples_full"],
        [{ tasks: { image_background: { extra: "x" } } }, "ai.guidance_unknown_task"],
        // A task's craft is a field of its own now (adr/0074 §3, ai-craft.spec.ts); others stay refused
        [{ tasks: { seo_title: { prompt: "Sen bir şairsin" } } }, "invalid_data"],
        [{ tasks: { seo_title: { craft: "a".repeat(3001) } } }, "ai.guidance_too_long"],
      ]
      for (const [body, message] of refusals) {
        const answer = await save(owner.headers, body)
        expect([answer.status, message === "invalid_data" ? message : messageOf(answer)]).toEqual([
          400,
          message,
        ])
      }

      const saved = await save(owner.headers, {
        guide: "<b>Bize</b> 0532 123 45 67 numarasından ulaşın​",
      })
      expect(saved.status).toBe(200)
      expect(saved.data.values.guide).toBe("Bize […] numarasından ulaşın")
      expect(JSON.stringify(saved.data)).not.toContain("0532")
    })
  },
})
