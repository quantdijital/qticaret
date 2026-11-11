import type { ExecArgs, MedusaContainer } from "@medusajs/framework/types"
import { tenantResultLine } from "@qticaret/types/control-plane"
import type { PlanImportResult } from "@qticaret/types/control-plane"
import { receivePlanDocument } from "../lib/control-plane/receive"

// As the push endpoint's body limit (adr/0061 §3.2)
const MAX_BYTES = 16 * 1024

/** Stdin as text, refused past `max` bytes. */
export async function readInput(
  input: AsyncIterable<Buffer | string>,
  max: number = MAX_BYTES
): Promise<string | null> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of input) {
    const buffer = typeof chunk === "string" ? Buffer.from(chunk) : chunk
    size += buffer.length
    if (size > max) {
      return null
    }
    chunks.push(buffer)
  }
  return Buffer.concat(chunks).toString("utf8")
}

/**
 * The shop's first plan document (adr/0061 §5.7, Ek C10), from the
 * provisioner before the shop is started: checked exactly as a push is
 * (strict shape, signature by `kid`, this shop's id, the serial rule) and
 * stored the same way (as a push: it came from the control plane, not
 * fetched). A refusal changes nothing.
 */
export async function importPlanDocument(
  container: MedusaContainer,
  text: string | null
): Promise<PlanImportResult> {
  let raw: unknown
  try {
    raw = text === null ? undefined : JSON.parse(text)
  } catch {
    raw = undefined
  }
  if (raw === undefined) {
    return { status: "refused", code: "control_plane.document_invalid" }
  }
  const result = await receivePlanDocument(container, raw, "push")
  switch (result.outcome) {
    case "unmanaged":
      return { status: "unmanaged" }
    case "refused":
      return { status: "refused", code: result.code }
    case "applied":
    case "same":
      return { status: result.outcome, serial: result.serial }
  }
}

/**
 * Usage: pnpm --filter @qticaret/backend tenant:plan-import < signed.json
 *
 * Reads `{ document, kid, signature }` from stdin (16 KB at most) and
 * prints one result line (`QT_TENANT_RESULT {...}`). Exits 1 unless the
 * document was applied or was already the stored one.
 */
export default async function planImport({ container }: ExecArgs): Promise<void> {
  const result = await importPlanDocument(container, await readInput(process.stdin))
  process.stdout.write(`${tenantResultLine(result)}\n`)
  if (result.status !== "applied" && result.status !== "same") {
    process.exitCode = 1
  }
}
