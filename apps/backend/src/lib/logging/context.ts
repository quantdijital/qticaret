import { AsyncLocalStorage } from "node:async_hooks"

/**
 * Per-request values every log line carries. The HTTP layer opens the
 * context; steps, services and subscribers that run inside the request
 * (async continuations included) inherit it without passing it along.
 */
export interface RequestContext {
  readonly requestId: string
}

const storage = new AsyncLocalStorage<RequestContext>()

export function runWithRequestContext<T>(context: RequestContext, run: () => T): T {
  return storage.run(context, run)
}

export function currentRequestId(): string | undefined {
  return storage.getStore()?.requestId
}
