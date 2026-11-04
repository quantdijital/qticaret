import { fakeTurkiyeApiDataset } from "@qticaret/testing"
import { ProviderError } from "../../../errors"
import type { TurkiyeApi } from "../client"
import { readTurkiyeApi } from "../read"
import type { TurkiyeApiMeta } from "../schemas"

const dataset = fakeTurkiyeApiDataset()
const counts = {
  provinces: dataset.provinces.length,
  districts: dataset.districts.length,
  municipalities: dataset.municipalities.length,
  neighborhoods: dataset.neighborhoods.length,
  villages: dataset.villages.length,
}
const meta: TurkiyeApiMeta = { datasetVersion: "2025", lastUpdated: "2026-05-21", counts }

function api(overrides: Partial<TurkiyeApi> = {}): TurkiyeApi {
  return {
    meta: () => Promise.resolve(meta),
    collection: (name) => Promise.resolve(dataset[name] as never),
    ...overrides,
  }
}

const codeOf = async (promise: Promise<unknown>) =>
  promise.then(
    () => "resolved",
    (error: unknown) => (error as { safeMessage?: string }).safeMessage
  )

describe("readTurkiyeApi", () => {
  it("reads every collection and reports its progress", async () => {
    const progress = jest.fn(() => Promise.resolve())
    const read = await readTurkiyeApi(api(), progress)

    expect(read.meta).toEqual(meta)
    expect(read.rows.length).toBe(83 + 11 + 2)
    expect(progress).toHaveBeenLastCalledWith(5, 5)
  })

  it("refuses a dataset shorter than /meta says, or without all 81 provinces", async () => {
    const short = api({
      meta: () => Promise.resolve({ ...meta, counts: { ...counts, villages: 3 } }),
    })
    expect(await codeOf(readTurkiyeApi(short))).toBe("tr_address.dataset_incomplete")

    const fewer = {
      ...meta,
      counts: { ...counts, provinces: 80 },
    }
    const eighty = api({
      meta: () => Promise.resolve(fewer),
      collection: (name) =>
        Promise.resolve(
          (name === "provinces" ? dataset.provinces.slice(1) : dataset[name]) as never
        ),
    })
    expect(await codeOf(readTurkiyeApi(eighty))).toBe("tr_address.dataset_incomplete")
  })

  it("refuses a dataset that changed while it was read", async () => {
    let calls = 0
    const moving = api({
      meta: () => Promise.resolve(calls++ === 0 ? meta : { ...meta, lastUpdated: "2026-06-01" }),
    })

    expect(await codeOf(readTurkiyeApi(moving))).toBe("tr_address.dataset_changed")
  })

  it("says the source is unavailable when TürkiyeAPI cannot be reached", async () => {
    const down = new ProviderError({
      provider: "turkiyeapi",
      providerCode: "http_503",
      retryable: true,
    })

    expect(await codeOf(readTurkiyeApi(api({ meta: () => Promise.reject(down) })))).toBe(
      "tr_address.source_unavailable"
    )
    expect(await codeOf(readTurkiyeApi(api({ collection: () => Promise.reject(down) })))).toBe(
      "tr_address.source_unavailable"
    )
  })
})
