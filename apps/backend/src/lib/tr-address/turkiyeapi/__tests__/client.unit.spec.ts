import { startFakeTurkiyeApi } from "@qticaret/testing"
import type { FakeTurkiyeApi } from "@qticaret/testing"
import { createMemoryFailureLog } from "../../../clients/failure-log"
import { isProviderError } from "../../../errors"
import { createTurkiyeApi } from "../client"

describe("createTurkiyeApi", () => {
  let fake: FakeTurkiyeApi
  const client = () =>
    createTurkiyeApi({
      baseUrl: fake.url,
      sleep: () => Promise.resolve(),
      failureLog: () => createMemoryFailureLog(),
    })

  beforeEach(async () => {
    fake = await startFakeTurkiyeApi()
  })
  afterEach(async () => {
    await fake.close()
  })

  it("reads /meta and a collection from its dataset file", async () => {
    const api = client()

    expect(await api.meta()).toMatchObject({ datasetVersion: "2025", lastUpdated: "2026-05-21" })
    const villages = await api.collection("villages")
    expect(villages.map((village) => village.name)).toEqual(["Alcalı", "Fatih"])
    expect(fake.requests).toEqual(["/v2/meta", "/v2/datasets/villages.json"])
  })

  it("pages through the list when the dataset file fails", async () => {
    fake.failFiles = true

    const provinces = await client().collection("provinces")

    expect(provinces).toHaveLength(81)
    expect(fake.requests.filter((path) => path === "/v2/provinces")).toHaveLength(1)
  })

  it("throws a provider error when the service is down", async () => {
    fake.down = true

    const failure = await client()
      .meta()
      .catch((error: unknown) => error)

    expect(isProviderError(failure)).toBe(true)
  })
})
