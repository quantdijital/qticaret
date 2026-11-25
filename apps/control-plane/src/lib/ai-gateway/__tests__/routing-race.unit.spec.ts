import { aiProviderKeyName, aiProviderOfKeyName } from "../../vault/secret-names"
import { deleteProviderKey } from "../keys"
import { saveAiSettingsWithKeys } from "../routing-keys"

/**
 * P6b: a key's delete and a routing save racing each other leave nothing
 * routed to a service whose key is gone. The routing row and the key live
 * in two modules' transactions, so the delete unroutes again once the key
 * is retired and the save reads the keys again once it has written. The
 * two stores are in memory here; each test plays one interleaving.
 */

interface Route {
  service: string
  model: string
}

const nothing = (): Promise<void> => Promise.resolve()

const state = {
  routing: {} as Record<string, Route>,
  held: new Set<string>(),
  /** Runs inside the vault's retire, before the key is gone. */
  duringRetire: nothing,
  /** Runs inside the settings save, after its check and before it writes. */
  duringSave: nothing,
}

const snapshot = () => ({
  dailyCap: 300,
  lifetimeMonths: 12,
  packs: [],
  routing: { ...state.routing },
})

jest.mock("../../ai-credits/platform-settings", () => ({
  aiCreditSettingsOf: jest.fn(() => Promise.resolve(snapshot())),
  saveAiCreditSettings: jest.fn(
    async (_container: unknown, change: { routing?: Record<string, Route | null> }) => {
      const before = snapshot()
      await state.duringSave()
      state.routing = Object.fromEntries(
        Object.entries(change.routing ?? {}).filter((entry): entry is [string, Route] => !!entry[1])
      )
      return { before, after: snapshot() }
    }
  ),
  unrouteService: jest.fn((_container: unknown, service: string) => {
    const entries = Object.entries(state.routing)
    state.routing = Object.fromEntries(entries.filter(([, route]) => route.service !== service))
    return Promise.resolve(
      entries.filter(([, route]) => route.service === service).map(([cap]) => cap)
    )
  }),
}))

const vault = {
  listSecretRecords: jest.fn((filter: { name: string[] }) =>
    Promise.resolve(
      filter.name
        .filter((name) => {
          const service = aiProviderOfKeyName(name)
          return service !== null && state.held.has(service)
        })
        .map((name) => ({ name, version: 1, created_at: new Date("2026-11-25T00:00:00Z") }))
    )
  ),
  retireSecret: jest.fn(async (_owner: string, name: string) => {
    await state.duringRetire()
    const service = aiProviderOfKeyName(name)
    return service !== null && state.held.delete(service)
  }),
}
const container = { resolve: jest.fn(() => vault) }

const routedKeyless = () =>
  Object.values(state.routing).filter((route) => !state.held.has(route.service))

describe("a key's delete racing a routing save (P6b)", () => {
  beforeEach(() => {
    state.routing = { text: { service: "deepseek", model: "deepseek-flash" } }
    state.held = new Set(["deepseek", "fake"])
    state.duringRetire = nothing
    state.duringSave = nothing
    jest.clearAllMocks()
  })

  it("leaves no routing to the service once the delete is done (one after the other)", async () => {
    const done = await deleteProviderKey(container, "deepseek", "user_owner")

    expect(done).toEqual({ deleted: true, unrouted: ["text"] })
    expect(state.routing).toEqual({})
    expect(state.held.has("deepseek")).toBe(false)
  })

  it("takes out a routing a save wrote between the first unroute and the retire", async () => {
    state.routing = {}
    // The save saw the key held before the retire and commits now
    state.duringRetire = async () => {
      await saveAiSettingsWithKeys(
        container,
        { routing: { text: { service: "deepseek", model: "deepseek-flash" } } },
        "user_other"
      )
    }

    const done = await deleteProviderKey(container, "deepseek", "user_owner")

    expect(done.unrouted).toEqual(["text"])
    expect(routedKeyless()).toEqual([])
    expect(state.routing).toEqual({})
  })

  it("takes out a routing a save commits after the whole delete, and answers without it", async () => {
    state.routing = {}
    // The save checked the keys (deepseek held), then the delete ran start to end
    state.duringSave = async () => {
      await deleteProviderKey(container, "deepseek", "user_owner")
    }

    const saved = await saveAiSettingsWithKeys(
      container,
      {
        routing: {
          text: { service: "deepseek", model: "deepseek-flash" },
          vision: { service: "fake", model: "fake-vision" },
        },
      },
      "user_other"
    )

    expect(routedKeyless()).toEqual([])
    expect(state.routing).toEqual({ vision: { service: "fake", model: "fake-vision" } })
    expect(saved.after.routing).toEqual(state.routing)
  })

  it("keeps a save's routing as it is while its key stays held", async () => {
    const saved = await saveAiSettingsWithKeys(
      container,
      { routing: { text: { service: "fake", model: "fake-text" } } },
      "user_other"
    )

    expect(saved.after.routing).toEqual({ text: { service: "fake", model: "fake-text" } })
    expect(state.routing).toEqual(saved.after.routing)
    expect(vault.listSecretRecords).toHaveBeenCalledTimes(2)
  })

  it("names the key it retires by the vault's own name", async () => {
    await deleteProviderKey(container, "deepseek", "user_owner")

    expect(vault.retireSecret).toHaveBeenCalledWith("platform", aiProviderKeyName("deepseek"))
  })
})
