import { randomBytes } from "node:crypto"
import type Redis from "ioredis"
import { parseEnv } from "../../env"
import { createRedisClient, tenantNamespace } from "../../redis"
import type { ConverseMessage, ToolCall } from "../connectors/types"

/**
 * The assistant's conversation (adr/0079 §6, §7): kept on the server
 * only, under the person's own key, never sent back whole and never taken
 * from the panel (which sends the conversation's id alone, so no history
 * and no tool result can be slipped in). Lapses after 2 hours idle and
 * 24 hours at most; "Yeni sohbet" deletes it. Nothing of it is written to
 * the database, the usage rows, the log or the audit trail. Without Redis
 * (a developer's machine) it lives in this process.
 */

export const CONVERSATION_ID = /^aiconv_[0-9a-f]{32}$/
export const CONVERSATION_IDLE_MS = 2 * 60 * 60 * 1000
export const CONVERSATION_MAX_MS = 24 * 60 * 60 * 1000
/** Messages kept; the model is given the last `CONTEXT_MESSAGES` of them (loop.ts). */
export const MAX_STORED_MESSAGES = 40

/** A screen named in a reply, for the panel's link. */
export interface ScreenRef {
  key: string
  label: string
}

/** A message as kept: the service's shape, a reply's screens beside it. */
export type StoredMessage = ConverseMessage & { screens?: ScreenRef[] }

export interface ConversationRecord {
  user_id: string
  /** Epoch ms. */
  created_at: number
  updated_at: number
  messages: StoredMessage[]
}

export interface ConversationStore {
  put: (key: string, record: ConversationRecord, ttlMs: number) => Promise<void>
  get: (key: string) => Promise<ConversationRecord | null>
  remove: (key: string) => Promise<void>
}

export const newConversationId = (): string => `aiconv_${randomBytes(16).toString("hex")}`

/** The record's key: the person's id in it, so one never reads another's. */
export const conversationKey = (userId: string, id: string): string => `${userId}:${id}`

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const isCall = (value: unknown): value is ToolCall =>
  isRecord(value) &&
  typeof value["id"] === "string" &&
  typeof value["name"] === "string" &&
  typeof value["arguments"] === "string"

function isMessage(value: unknown): value is StoredMessage {
  if (!isRecord(value)) {
    return false
  }
  const { role, content } = value
  if (role === "tool") {
    return typeof value["toolCallId"] === "string" && typeof content === "string"
  }
  if (role === "assistant") {
    const calls = value["toolCalls"]
    return (
      (typeof content === "string" || content === null) &&
      (calls === undefined || (Array.isArray(calls) && calls.every(isCall)))
    )
  }
  return (role === "user" || role === "system") && typeof content === "string"
}

/** A record read back, or null for anything not shaped like one. */
export function recordOf(text: string | null): ConversationRecord | null {
  if (!text) {
    return null
  }
  try {
    const value: unknown = JSON.parse(text)
    return isRecord(value) &&
      typeof value["user_id"] === "string" &&
      typeof value["created_at"] === "number" &&
      typeof value["updated_at"] === "number" &&
      Array.isArray(value["messages"]) &&
      value["messages"].every(isMessage)
      ? (value as unknown as ConversationRecord)
      : null
  } catch {
    return null
  }
}

/** How long a record is kept from `now`: idle time, never past 24 hours from its start. */
export const ttlOf = (record: Pick<ConversationRecord, "created_at">, now: number): number =>
  Math.min(CONVERSATION_IDLE_MS, record.created_at + CONVERSATION_MAX_MS - now)

export function createRedisConversationStore(redis: Redis, prefix: string): ConversationStore {
  const key = (id: string) => `${prefix}${id}`
  return {
    put: async (id, record, ttlMs) => {
      await redis.set(key(id), JSON.stringify(record), "PX", Math.max(1, Math.floor(ttlMs)))
    },
    get: async (id) => recordOf(await redis.get(key(id))),
    remove: async (id) => {
      await redis.del(key(id))
    },
  }
}

export function createMemoryConversationStore(now: () => number = Date.now): ConversationStore {
  const records = new Map<string, { text: string; until: number }>()
  return {
    put: (id, record, ttlMs) => {
      records.set(id, { text: JSON.stringify(record), until: now() + ttlMs })
      return Promise.resolve()
    },
    get: (id) => {
      const entry = records.get(id)
      if (entry && entry.until <= now()) {
        records.delete(id)
      }
      return Promise.resolve(recordOf(records.get(id)?.text ?? null))
    },
    remove: (id) => {
      records.delete(id)
      return Promise.resolve()
    },
  }
}

let shared: ConversationStore | undefined

/** The tenant's store: Redis when configured, else this process's memory. */
export function conversationStore(): ConversationStore {
  if (shared) {
    return shared
  }
  const env = parseEnv()
  const prefix = `qt:aiconv:${tenantNamespace(env.DATABASE_URL, env.NODE_ENV, process.env["QT_TEST_RUN"])}:`
  shared = env.REDIS_URL
    ? createRedisConversationStore(createRedisClient(env.REDIS_URL, "ai_conversation"), prefix)
    : createMemoryConversationStore()
  return shared
}

/**
 * The last `count` messages, starting at a person's message: a tool's
 * result is never left without the call it answers (services refuse it).
 */
export function lastMessages<T extends { role: string }>(
  messages: readonly T[],
  count: number
): T[] {
  const tail = messages.slice(-count)
  const start = tail.findIndex((message) => message.role === "user")
  return start === -1 ? [] : tail.slice(start)
}

/** The person's conversation, or null when it lapsed, is another's or never was. */
export async function loadConversation(
  store: ConversationStore,
  userId: string,
  id: string,
  now: number = Date.now()
): Promise<ConversationRecord | null> {
  if (!CONVERSATION_ID.test(id)) {
    return null
  }
  const record = await store.get(conversationKey(userId, id))
  return record !== null && record.user_id === userId && ttlOf(record, now) > 0 ? record : null
}

/** Keeps the record, its last messages only, for its time left; a lapsed one is not kept. */
export async function saveConversation(
  store: ConversationStore,
  id: string,
  record: ConversationRecord,
  now: number = Date.now()
): Promise<void> {
  const ttl = ttlOf(record, now)
  const key = conversationKey(record.user_id, id)
  if (ttl <= 0) {
    await store.remove(key)
    return
  }
  const messages = lastMessages(record.messages, MAX_STORED_MESSAGES)
  await store.put(key, { ...record, messages, updated_at: now }, ttl)
}

/** What the panel shows of it: the person's words and the replies, no tool step. */
export interface VisibleMessage {
  role: "user" | "assistant"
  text: string
  screens?: ScreenRef[]
}

export function visibleMessages(record: ConversationRecord): VisibleMessage[] {
  return record.messages.flatMap((message): VisibleMessage[] => {
    if (message.role === "user") {
      return [{ role: "user", text: message.content }]
    }
    if (
      message.role === "assistant" &&
      typeof message.content === "string" &&
      (message.toolCalls?.length ?? 0) === 0
    ) {
      return [
        {
          role: "assistant",
          text: message.content,
          ...(message.screens === undefined ? {} : { screens: message.screens }),
        },
      ]
    }
    return []
  })
}
