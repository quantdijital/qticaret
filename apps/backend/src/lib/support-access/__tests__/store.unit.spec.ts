import { createMemorySupportStore } from "../store"
import type { SupportSession } from "../store"
import { grantIdOfActor, sessionOfGrant, sessionState, supportActorOf } from "../session"

const session = (over: Partial<SupportSession> = {}): SupportSession => ({
  grant_id: "sgr_AAECAwQFBgcICQoLDA0ODxAREhMUFRYX",
  actor_id: "qtsup_AAECAwQFBgcICQoLDA0ODxAREhMUFRYX",
  operator: { id: "user_1", name: "Ayşe", role: "operator" },
  reason: "Ürün girişine yardım",
  started_at: new Date(0).toISOString(),
  expires_at: new Date(60_000).toISOString(),
  ...over,
})

describe("support sessions' store and state (Karar 3–4)", () => {
  it("claims a grant once: a replay is refused until the claim runs out", async () => {
    let now = 0
    const store = createMemorySupportStore(() => now)
    await expect(store.claimGrant("sgr_x", 1000)).resolves.toBe(true)
    await expect(store.claimGrant("sgr_x", 1000)).resolves.toBe(false)
    now = 999
    await expect(store.claimGrant("sgr_x", 1000)).resolves.toBe(false)
  })

  it("keeps a session till its time, then forgets it", async () => {
    let now = 0
    const store = createMemorySupportStore(() => now)
    await store.put(session(), 60_000)
    await expect(store.get(session().grant_id)).resolves.toMatchObject({
      reason: "Ürün girişine yardım",
    })
    await expect(store.list()).resolves.toHaveLength(1)
    now = 60_000
    await expect(store.get(session().grant_id)).resolves.toBeNull()
    await expect(store.list()).resolves.toHaveLength(0)
  })

  it("reads a session open only while it is kept, not ended, in time and the switch on", () => {
    expect(sessionState(session(), { now: 1, enabled: true })).toBe("open")
    expect(sessionState(null, { now: 1, enabled: true })).toBe("missing")
    expect(sessionState(session(), { now: 60_000, enabled: true })).toBe("expired")
    expect(sessionState(session(), { now: 1, enabled: false })).toBe("disabled")
    expect(
      sessionState(session({ ended_reason: "ended_by_owner" }), { now: 1, enabled: true })
    ).toBe("ended_by_owner")
  })

  it("names the actor after the grant, and back", () => {
    const grantId = "sgr_AAECAwQFBgcICQoLDA0ODxAREhMUFRYX"
    expect(supportActorOf(grantId)).toBe("qtsup_AAECAwQFBgcICQoLDA0ODxAREhMUFRYX")
    expect(grantIdOfActor(supportActorOf(grantId))).toBe(grantId)
  })

  it("opens a session ending at the grant's end, never later", () => {
    const opened = sessionOfGrant(
      {
        version: 1,
        audience: "shop_panel",
        tenant_id: "ten_1",
        grant_id: "sgr_AAECAwQFBgcICQoLDA0ODxAREhMUFRYX",
        operator: { id: "user_1", name: "Ayşe", role: "owner" },
        reason: "Görünüm kurulumu için",
        issued_at: 1_795_000_000,
        expires_at: 1_795_001_800,
      },
      new Date(1_795_000_010_000)
    )
    expect(opened.expires_at).toBe(new Date(1_795_001_800_000).toISOString())
    expect(opened.actor_id.startsWith("qtsup_")).toBe(true)
  })
})
