/** A Store API answer that was not a success: its status and message key (`errors.*`). */
export class StoreApiError extends Error {
  override readonly name = "StoreApiError"

  constructor(
    readonly status: number,
    readonly messageKey: string | null,
    readonly requestId: string | null
  ) {
    super(`Store API answered ${String(status)}${messageKey ? ` (${messageKey})` : ""}`)
  }
}

export const isStoreApiError = (error: unknown): error is StoreApiError =>
  error instanceof StoreApiError

export const isNotFound = (error: unknown): boolean =>
  isStoreApiError(error) && error.status === 404
