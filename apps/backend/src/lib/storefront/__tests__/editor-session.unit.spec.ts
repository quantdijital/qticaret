import { randomBytes } from "node:crypto"
import { layoutPreview } from "../../content/preview-token"
import {
  SESSION_IDLE_MS,
  closeEditorSession,
  createMemorySessionStore,
  editorSessionOf,
  openEditorSession,
  renewEditorSession,
} from "../editor-session"

/**
 * The theme editor's live preview session (adr/0065 §1): a signed token
 * that opens while its record is kept, bound to who opened it from which
 * panel session; idle for 30 minutes, 12 hours at most; renewed and ended
 * by its own staff member only; no other kind of token opens it.
 */

const KEY = randomBytes(32)
const OTHER_KEY = randomBytes(32)
const OWNER = { userId: "user_01OWNER", sid: "sid-owner" }
const T0 = new Date("2026-11-15T09:00:00.000Z")
const at = (ms: number) => new Date(T0.getTime() + ms)
const MINUTE = 60 * 1000

function setup() {
  let clock = T0.getTime()
  const store = createMemorySessionStore(() => clock)
  return {
    store,
    tick: (ms: number) => {
      clock += ms
      return new Date(clock)
    },
  }
}

describe("the theme editor's live preview session", () => {
  it("opens with a token of its own shape that reads its record", async () => {
    const { store } = setup()
    const opened = await openEditorSession(store, KEY, OWNER, T0)
    expect(opened.id).toMatch(/^sfs_[0-9a-f]{32}$/)
    expect(opened.token.startsWith(`${opened.id}.`)).toBe(true)
    expect(opened.expires_at.getTime()).toBe(T0.getTime() + 12 * 60 * MINUTE)
    const record = await editorSessionOf(store, KEY, opened.token, T0)
    expect(record).toMatchObject({ user_id: OWNER.userId, sid: OWNER.sid })
  })

  it("gives every session its own id", async () => {
    const { store } = setup()
    const a = await openEditorSession(store, KEY, OWNER, T0)
    const b = await openEditorSession(store, KEY, OWNER, T0)
    expect(a.id).not.toBe(b.id)
  })

  it("opens nothing for a forged, altered or other key's token", async () => {
    const { store } = setup()
    const { token } = await openEditorSession(store, KEY, OWNER, T0)
    expect(await editorSessionOf(store, OTHER_KEY, token, T0)).toBeNull()
    const last = token.at(-1) === "A" ? "B" : "A"
    expect(await editorSessionOf(store, KEY, `${token.slice(0, -1)}${last}`, T0)).toBeNull()
    expect(await editorSessionOf(store, KEY, "sfs_x", T0)).toBeNull()
    expect(await editorSessionOf(store, KEY, "", T0)).toBeNull()
  })

  it("never mixes kinds: a design link is no session, a session no design link", async () => {
    const { store } = setup()
    const design = layoutPreview.token(KEY, { id: "sfl_01ROW", updated_at: T0 }, T0)
    expect(await editorSessionOf(store, KEY, design.token, T0)).toBeNull()
    const { token } = await openEditorSession(store, KEY, OWNER, T0)
    expect(layoutPreview.parts(token, T0)).toBeNull()
  })

  it("lapses once idle for 30 minutes; a renewal keeps it", async () => {
    const { store, tick } = setup()
    const { id, token } = await openEditorSession(store, KEY, OWNER, T0)
    const later = tick(SESSION_IDLE_MS - MINUTE)
    expect(await renewEditorSession(store, id, OWNER, later)).toBe(true)
    const stillOpen = tick(SESSION_IDLE_MS - MINUTE)
    expect(await editorSessionOf(store, KEY, token, stillOpen)).not.toBeNull()
    const idle = tick(2 * MINUTE)
    expect(await editorSessionOf(store, KEY, token, idle)).toBeNull()
    expect(await renewEditorSession(store, id, OWNER, idle)).toBe(false)
  })

  it("ends after 12 hours whatever its renewals", async () => {
    const { store, tick } = setup()
    const { id, token } = await openEditorSession(store, KEY, OWNER, T0)
    for (let step = 0; step < 47; step += 1) {
      expect(await renewEditorSession(store, id, OWNER, tick(15 * MINUTE))).toBe(true)
    }
    // 11 h 45 min in: still open
    expect(await editorSessionOf(store, KEY, token, at(47 * 15 * MINUTE))).not.toBeNull()
    const end = tick(15 * MINUTE)
    expect(await renewEditorSession(store, id, OWNER, end)).toBe(false)
    expect(await editorSessionOf(store, KEY, token, end)).toBeNull()
  })

  it("is renewed and closed by its own staff member only", async () => {
    const { store } = setup()
    const { id, token } = await openEditorSession(store, KEY, OWNER, T0)
    expect(
      await renewEditorSession(store, id, { userId: "user_01OTHER", sid: OWNER.sid }, T0)
    ).toBe(false)
    expect(await closeEditorSession(store, id, "user_01OTHER", T0)).toBe(false)
    expect(await editorSessionOf(store, KEY, token, T0)).not.toBeNull()
    expect(await closeEditorSession(store, id, OWNER.userId, T0)).toBe(true)
    // Closed: its token opens nothing, closing again finds nothing
    expect(await editorSessionOf(store, KEY, token, T0)).toBeNull()
    expect(await closeEditorSession(store, id, OWNER.userId, T0)).toBe(false)
  })

  it("is renewed only from the panel session it was opened from", async () => {
    const { store, tick } = setup()
    const { id, token } = await openEditorSession(store, KEY, OWNER, T0)
    const later = tick(SESSION_IDLE_MS - MINUTE)
    // The same member signed in elsewhere, or with no panel session, keeps nothing alive
    expect(await renewEditorSession(store, id, { ...OWNER, sid: "sid-elsewhere" }, later)).toBe(
      false
    )
    expect(await renewEditorSession(store, id, { ...OWNER, sid: "" }, later)).toBe(false)
    expect(await editorSessionOf(store, KEY, token, tick(2 * MINUTE))).toBeNull()
  })

  it("refuses a malformed id before reading the store", async () => {
    const { store } = setup()
    expect(await renewEditorSession(store, "../../x", OWNER, T0)).toBe(false)
    expect(await closeEditorSession(store, "sfs_*", OWNER.userId, T0)).toBe(false)
  })
})
