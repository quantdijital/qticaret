/**
 * Connectors: one narrow interface per capability (adr/0071 §2). The key
 * is given when a connector is made and lives only in its closure: it is
 * no part of a request, a result or an error.
 */

/** What the service counted; absent where it does not say. */
export interface AiUsage {
  inputTokens?: number
  outputTokens?: number
}

export interface AiImageInput {
  mimeType: string
  bytes: Buffer
}

export interface TextRequest {
  /** The fixed instruction (lib/ai/prompt.ts). */
  system: string
  /** The data block, a JSON text, sent as its own message. */
  data: string
  maxTokens: number
  /** Ask for a JSON object where the service documents such a mode. */
  json?: boolean
  /**
   * The task's sampling temperature (adr/0074 §4); sent only where the
   * service's target is documented to take one (`temperature`), else left out.
   */
  temperature?: number
  /** `vision` only. */
  images?: readonly AiImageInput[]
  signal?: AbortSignal
}

export interface TextResult {
  text: string
  usage: AiUsage
}

/** `text` and `vision`. */
export interface TextConnector {
  complete: (request: TextRequest) => Promise<TextResult>
}

/** Text and image reading (adr/0071 §8). */
export const TEXT_TIMEOUT_MS = 60_000
