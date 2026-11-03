import type { BulkMessage, BulkMessageInput } from "./types"

/**
 * `POST /admin/bulk-messages/:id`, not through the SDK: its error keeps
 * only the sentence, and the editor needs the backend's key beside it
 * (`code`, adr/0021) to put a refusal under its field: a text too long at
 * its longest (`campaigns.sms_too_long`) is one the panel cannot count
 * itself. A refusal has the shape `errorText` reads, its key added.
 */
export async function saveDraft(path: string, input: BulkMessageInput): Promise<BulkMessage> {
  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(input),
  })
  const data = (await response.json().catch(() => null)) as {
    campaign?: BulkMessage
    message?: unknown
    code?: unknown
  } | null
  if (!response.ok || !data?.campaign) {
    const message = typeof data?.message === "string" ? data.message : response.statusText
    throw Object.assign(new Error(message), {
      status: response.status,
      message,
      code: typeof data?.code === "string" ? data.code : null,
    })
  }
  return data.campaign
}

/** The backend's key of a refusal (`campaigns.sms_too_long`); null for anything else. */
export function refusalKey(error: unknown): string | null {
  const code = (error as { code?: unknown } | null)?.code
  return typeof code === "string" ? code : null
}
