import type Redis from "ioredis"
import {
  CONVERSATION_IDLE_MS,
  CONVERSATION_MAX_MS,
  MAX_STORED_MESSAGES,
  conversationKey,
  createMemoryConversationStore,
  createRedisConversationStore,
  lastMessages,
  loadConversation,
  newConversationId,
  recordOf,
  saveConversation,
  ttlOf,
  visibleMessages,
} from "../conversation"
import type { ConversationRecord } from "../conversation"

/** adr/0079 §6, §7 (Y1-1): the conversation is the server's, per person, and lapses. */

const START = Date.UTC(2026, 10, 24, 9, 0, 0)

const record = (overrides: Partial<ConversationRecord> = {}): ConversationRecord => ({
  user_id: "user_a",
  created_at: START,
  updated_at: START,
  messages: [
    { role: "user", content: "kargo ücreti" },
    {
      role: "assistant",
      content: null,
      toolCalls: [{ id: "c", name: "find_screen", arguments: "{}" }],
    },
    { role: "tool", toolCallId: "c", content: '{"untrusted":true,"data":{}}' },
    {
      role: "assistant",
      content: "Şurada: [[settings.shipping.options]]",
      screens: [{ key: "settings.shipping.options", label: "settings.shipping.tabs.options" }],
    },
  ],
  ...overrides,
})

describe("conversation store", () => {
  it("keeps a record 2 hours idle, never past 24 hours from its start", () => {
    expect(ttlOf(record(), START)).toBe(CONVERSATION_IDLE_MS)
    expect(ttlOf(record(), START + CONVERSATION_MAX_MS - 60_000)).toBe(60_000)
    expect(ttlOf(record(), START + CONVERSATION_MAX_MS)).toBeLessThanOrEqual(0)
  })

  it("sets Redis's expiry on every save, a day at most", async () => {
    const set = jest.fn().mockResolvedValue("OK")
    const store = createRedisConversationStore({ set } as unknown as Redis, "qt:aiconv:t:")
    const id = newConversationId()

    await saveConversation(store, id, record(), START + CONVERSATION_MAX_MS - 1_000)

    expect(set).toHaveBeenCalledWith(`qt:aiconv:t:user_a:${id}`, expect.any(String), "PX", 1_000)
    await saveConversation(store, id, record(), START)
    const ttl = (set.mock.calls as unknown[][])[1]?.[3] as number
    expect(ttl).toBeLessThanOrEqual(CONVERSATION_MAX_MS)
    expect(ttl).toBe(CONVERSATION_IDLE_MS)
  })

  it("reads only the person's own conversation, and none that lapsed", async () => {
    let now = START
    const store = createMemoryConversationStore(() => now)
    const id = newConversationId()
    await saveConversation(store, id, record(), now)

    await expect(loadConversation(store, "user_a", id, now)).resolves.toMatchObject({
      user_id: "user_a",
    })
    await expect(loadConversation(store, "user_b", id, now)).resolves.toBeNull()
    await expect(loadConversation(store, "user_a", "aiconv_not-an-id", now)).resolves.toBeNull()
    now += CONVERSATION_IDLE_MS + 1
    await expect(loadConversation(store, "user_a", id, now)).resolves.toBeNull()
  })

  it("keeps the last messages only, never a tool result without its call", async () => {
    const store = createMemoryConversationStore(() => START)
    const id = newConversationId()
    const many = Array.from({ length: 12 }, () => record().messages).flat()
    await saveConversation(store, id, record({ messages: many }), START)

    const kept = await store.get(conversationKey("user_a", id))
    expect(kept?.messages.length).toBeLessThanOrEqual(MAX_STORED_MESSAGES)
    expect(kept?.messages[0]?.role).toBe("user")
    expect(lastMessages(record().messages, 2)).toEqual([])
  })

  it("refuses a record not shaped like one", () => {
    expect(recordOf("not json")).toBeNull()
    expect(recordOf(JSON.stringify({ ...record(), messages: [{ role: "tool" }] }))).toBeNull()
    expect(recordOf(JSON.stringify(record()))).toEqual(record())
  })

  it("shows the panel the person's words and the replies, no tool step", () => {
    expect(visibleMessages(record())).toEqual([
      { role: "user", text: "kargo ücreti" },
      {
        role: "assistant",
        text: "Şurada: [[settings.shipping.options]]",
        screens: [{ key: "settings.shipping.options", label: "settings.shipping.tabs.options" }],
      },
    ])
  })
})
