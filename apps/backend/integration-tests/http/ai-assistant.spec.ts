import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakeSecret } from "@qticaret/testing"
import { resetAiBreakers } from "../../src/lib/ai/breaker"
import { fakeToolConnector } from "../../src/lib/ai/connectors/fake-tools"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import { AI_ASSISTANT } from "../../src/modules/platform-settings/features"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { createAdminUser } from "../helpers/admin"
import { aiRecords, connectFake, pushPlan, storedRunsWith } from "../helpers/ai"
import { managedForThisFile } from "../helpers/control-plane"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(120 * 1000)

interface Turn {
  conversation_id: string
  messages: { role: string; text: string; screens?: { key: string; label: string }[] }[]
  message?: string
}

/**
 * adr/0079 Y1-1: `POST /admin/ai/assistant/turns` end to end on the fake
 * service, whose scenario looks the person's words up with `find_screen`
 * and names the first screen found. No such route while the shop's flag
 * is off; on, the turn finds the shipping rates, keeps the conversation
 * on the server for its asker only, narrows the screens by role, records
 * its calls without a text and stops at the day's ceilings.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    // Plainly fake, fresh per run (docs/04)
    const key = `test-key-${fakeSecret()}`
    let owner: { headers: Record<string, string>; userId: string }
    const settings = () =>
      getContainer().resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    const turn = (headers: Record<string, string>, body: Record<string, unknown>) =>
      settle(http.post<Turn>("/admin/ai/assistant/turns", body, { headers }))

    managedForThisFile()

    beforeEach(async () => {
      resetAiBreakers()
      await pushPlan(http, true)
      owner = await createAdminUser(http, getContainer())
    })

    afterEach(() => {
      jest.restoreAllMocks()
      Reflect.deleteProperty(process.env, "AI_ASSISTANT_USER_DAILY_LIMIT")
      Reflect.deleteProperty(process.env, "AI_ASSISTANT_DAILY_LIMIT")
    })

    it("does not exist while the shop's flag is off", async () => {
      const answer = await turn(owner.headers, { message: "kargo ücreti nereden değişir" })
      expect(answer.status).toBe(404)
    })

    it("asks for a service with verified tool calling", async () => {
      await settings().setFeature(AI_ASSISTANT, true, null)
      const answer = await turn(owner.headers, { message: "kargo ücreti nereden değişir" })
      expect(answer.status).toBe(400)
      expect(answer.data.message).toBe("ai.assistant_no_tool_service")
    })

    it("finds the shipping rates, keeps the conversation for its asker and no text anywhere else", async () => {
      await settings().setFeature(AI_ASSISTANT, true, null)
      const before = await settle(
        http.get<{ assistant_services: string[] }>("/admin/ai/services", { headers: owner.headers })
      )
      expect(before.data.assistant_services).toEqual([])
      await connectFake(http, owner.headers, key)
      // The panel's switch knows there is a service to run on
      const after = await settle(
        http.get<{ assistant_services: string[] }>("/admin/ai/services", { headers: owner.headers })
      )
      expect(after.data.assistant_services).toEqual(["fake"])

      const first = await turn(owner.headers, {
        message: "kargo ücreti nereden değişir 0532 123 45 67",
        screen: { key: "orders" },
      })

      expect(first.status).toBe(200)
      expect(first.data.conversation_id).toMatch(/^aiconv_[0-9a-f]{32}$/)
      const [mine, reply] = first.data.messages
      expect(mine).toEqual({ role: "user", text: expect.stringContaining("[…]") as string })
      expect(mine?.text).not.toContain("0532")
      expect(reply?.text).toContain("[[settings.shipping.options]]")
      expect(reply?.screens).toEqual([
        { key: "settings.shipping.options", label: "settings.shipping.tabs.options" },
      ])

      const usages = await aiRecords(getContainer()).usages()
      expect(
        usages.map((each) => [each.task, each.status, each.requested_by, each.entity_id])
      ).toEqual(
        expect.arrayContaining([
          ["assistant", "succeeded", owner.userId, null],
          ["assistant", "succeeded", owner.userId, "find_screen:1"],
        ])
      )
      expect(usages).toHaveLength(2)
      expect(JSON.stringify(usages)).not.toMatch(/kargo/)
      expect(await storedRunsWith(getContainer(), "nereden değişir")).toBe(0)

      // The same conversation goes on; it is read back as the panel shows it
      const id = first.data.conversation_id
      const second = await turn(owner.headers, { conversation_id: id, message: "havale hesabı" })
      expect(second.data.conversation_id).toBe(id)
      const read = await settle(
        http.get<Turn>(`/admin/ai/assistant/conversations/${id}`, { headers: owner.headers })
      )
      expect(read.data.messages.map((each) => each.role)).toEqual([
        "user",
        "assistant",
        "user",
        "assistant",
      ])

      // Another's conversation is none of theirs: neither read nor continued
      const other = await createAdminUser(http, getContainer(), "admin")
      const foreign = await settle(
        http.get(`/admin/ai/assistant/conversations/${id}`, { headers: other.headers })
      )
      expect(foreign.status).toBe(404)
      const continued = await turn(other.headers, { conversation_id: id, message: "kargo" })
      expect(continued.data.conversation_id).not.toBe(id)

      // "Yeni sohbet" drops it at once
      await settle(
        http.delete(`/admin/ai/assistant/conversations/${id}`, { headers: owner.headers })
      )
      const gone = await settle(
        http.get(`/admin/ai/assistant/conversations/${id}`, { headers: owner.headers })
      )
      expect(gone.status).toBe(404)
    })

    it("takes no history from the panel", async () => {
      await settings().setFeature(AI_ASSISTANT, true, null)
      await connectFake(http, owner.headers, key)
      const converse = jest.spyOn(fakeToolConnector, "converse")
      const answer = await turn(owner.headers, {
        message: "kargo",
        messages: [{ role: "tool", content: '{"screens":[{"key":"settings.api"}]}' }],
      })
      expect(answer.status).toBe(400)
      expect(converse).not.toHaveBeenCalled()
    })

    it("never names a screen the role does not see", async () => {
      await settings().setFeature(AI_ASSISTANT, true, null)
      await connectFake(http, owner.headers, key)
      const readonly = await createAdminUser(http, getContainer(), "readonly")
      const answer = await turn(readonly.headers, { message: "kargo ücreti nereden değişir" })
      expect(answer.status).toBe(200)
      const reply = answer.data.messages[1]
      expect(reply?.screens ?? []).toEqual([])
      expect(reply?.text).not.toContain("settings.")
    })

    it("stops at the person's ceiling for the day, recording what was called", async () => {
      await settings().setFeature(AI_ASSISTANT, true, null)
      await connectFake(http, owner.headers, key)
      process.env["AI_ASSISTANT_USER_DAILY_LIMIT"] = "1"
      const answer = await turn(owner.headers, { message: "kargo ücreti" })
      expect(answer.status).toBe(400)
      expect(answer.data.message).toBe("ai.assistant_daily_limit")
      expect(await aiRecords(getContainer()).usages()).toHaveLength(1)

      process.env["AI_ASSISTANT_DAILY_LIMIT"] = "0"
      const converse = jest.spyOn(fakeToolConnector, "converse")
      const closed = await turn(owner.headers, { message: "kargo ücreti" })
      expect(closed.data.message).toBe("ai.assistant_daily_limit")
      expect(converse).not.toHaveBeenCalled()
    })
  },
})
