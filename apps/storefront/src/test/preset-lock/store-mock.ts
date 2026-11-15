import type { StoreLayout, StoreMenu } from "@qticaret/types"
import { StoreApiError } from "@/lib/store-api/errors"
import { storeAnswer } from "./fake-store-api"

/**
 * The preset lock's stand-in for `@/lib/store-api/server`: every GET the
 * pages make answered from the fixed shop with the preset applied, any
 * write refused. A spec mocks the module with this file
 * (`vi.mock("@/lib/store-api/server", () => import(...))`) and sets
 * `store` before it draws.
 */

type Query = Record<string, unknown> | undefined

export const store = {
  layout: null as StoreLayout | null,
  menus: [] as StoreMenu[],
  /** The answer to a GET; a spec drawing more pages widens it (`fake-page-api.ts`). */
  answer: storeAnswer,
}

const get = (path: string, query?: Query) => {
  if (!store.layout) {
    throw new Error("preset lock: no preset applied")
  }
  try {
    return Promise.resolve(store.answer(store.layout, store.menus, path, query))
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)))
  }
}

const find = async (path: string, query?: Query) => {
  try {
    return await get(path, query)
  } catch (error) {
    if (error instanceof StoreApiError && error.status === 404) return null
    throw error
  }
}

const refused = (path: string) =>
  Promise.reject(new Error(`preset lock: the page wrote to ${path}`))

export const storeGet = get
export const storePublicGet = get
export const storePublicFind = find
export const storeCall = (path: string, options: { query?: Query }) => get(path, options.query)
export const storeCallWithHeaders = refused
export const storePost = refused
export const storeDelete = refused
