import { ValidationError, isProviderError } from "../../errors"
import type { TrAddressRowInput } from "../../../modules/tr-address/import/rows"
import type { TurkiyeApi } from "./client"
import { toImportRows } from "./map"
import type { TurkiyeApiDataset } from "./map"
import type { CollectionName, TurkiyeApiMeta } from "./schemas"

export const TR_PROVINCE_COUNT = 81

const ORDER: readonly CollectionName[] = [
  "provinces",
  "districts",
  "municipalities",
  "neighborhoods",
  "villages",
]

export interface TurkiyeApiRead {
  meta: TurkiyeApiMeta
  rows: TrAddressRowInput[]
  orphans: number
}

/** TürkiyeAPI could not be reached or answered something unreadable: try again later. */
export const sourceUnavailable = (cause: unknown) =>
  new ValidationError("tr_address.source_unavailable", { cause })

/** The dataset's version, or an outage as `tr_address.source_unavailable`. */
export async function readTurkiyeApiMeta(api: TurkiyeApi): Promise<TurkiyeApiMeta> {
  try {
    return await api.meta()
  } catch (error) {
    throw isProviderError(error) ? sourceUnavailable(error) : error
  }
}

const sameVersion = (a: TurkiyeApiMeta, b: TurkiyeApiMeta) =>
  a.datasetVersion === b.datasetVersion && a.lastUpdated === b.lastUpdated

/**
 * The whole dataset as import rows. It replaces the shop's data and marks
 * whatever it lacks inactive, so it must be whole: every collection as
 * long as `/meta` says, all 81 provinces, and one version from the first
 * file to the last (`/meta` read again at the end).
 */
export async function readTurkiyeApi(
  api: TurkiyeApi,
  progress: (done: number, total: number) => Promise<void> = () => Promise.resolve()
): Promise<TurkiyeApiRead> {
  const meta = await readTurkiyeApiMeta(api)
  const dataset: Partial<TurkiyeApiDataset> = {}
  try {
    for (const [index, name] of ORDER.entries()) {
      Object.assign(dataset, { [name]: await api.collection(name) })
      await progress(index + 1, ORDER.length)
    }
  } catch (error) {
    throw isProviderError(error) ? sourceUnavailable(error) : error
  }
  const whole = dataset as TurkiyeApiDataset
  const short = ORDER.some((name) => whole[name].length !== meta.counts[name])
  if (short || whole.provinces.length !== TR_PROVINCE_COUNT) {
    throw new ValidationError("tr_address.dataset_incomplete")
  }
  if (!sameVersion(meta, await readTurkiyeApiMeta(api))) {
    throw new ValidationError("tr_address.dataset_changed")
  }
  return { meta, ...toImportRows(whole) }
}
