import type { ExecArgs } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import { PACK_CODE } from "@qticaret/sector-packs"
import { tenantResultLine } from "@qticaret/types/control-plane"
import type { LoadSamplesResult } from "@qticaret/types/control-plane"
import { isValidationError } from "../lib/errors"
import { planSampleLoad } from "../lib/sample-catalog/load-plan"
import { AUDIT_LOG_MODULE } from "../modules/audit-log"
import type AuditLogModuleService from "../modules/audit-log/service"
import { loadSampleCatalogWorkflow } from "../workflows/sample-catalog/load"

const ARG = "pack="

/** `pack=<code>` from `medusa exec`'s plain arguments; throws without a well-formed one. */
export function samplesPackArg(args: readonly string[]): string {
  const code = args.find((value) => value.startsWith(ARG))?.slice(ARG.length)
  if (!code || !PACK_CODE.test(code)) {
    throw new Error("load-samples: pack=<code> is required")
  }
  return code
}

/**
 * What the quick check's refusal means for the provisioner: no samples for
 * the pack here (or a pack the shop was not given), the set loaded already,
 * or null for anything else (thrown as it is).
 */
export function refusalOf(error: unknown): "unknown_samples" | "already_loaded" | null {
  // By its shape: an error may come back as another instance
  const shape = error as { type?: unknown; message?: unknown } | null
  if (shape?.type === MedusaError.Types.NOT_FOUND && shape.message === "sample_catalog.unknown") {
    return "unknown_samples"
  }
  if (!isValidationError(error)) {
    return null
  }
  if (error.safeMessage === "sample_catalog.pack_not_applied") {
    return "unknown_samples"
  }
  return error.safeMessage === "sample_catalog.already_loaded" ? "already_loaded" : null
}

const print = (result: LoadSamplesResult): void => {
  process.stdout.write(`${tenantResultLine(result)}\n`)
}

/**
 * Usage: pnpm --filter @qticaret/backend tenant:load-samples pack=<code>
 *
 * The pack's sample catalogue (the control plane wizard's "Örnek ürünlerle
 * başla"), the provisioner's `sample_catalog` step after the shop's look:
 * the same check and workflow as the panel's "Örnek içerik" card, run here
 * rather than as a background job (the shop is not serving yet). Every
 * record is marked as a sample, so the owner removes them from that card.
 * A failure part way takes back what it made. Prints one result line
 * (`QT_TENANT_RESULT {...}`); no samples for the pack prints
 * `unknown_samples` and exits 1; a set already here prints
 * `already_loaded`. Recorded in the audit log as the system's.
 */
export default async function loadSamples({ container, args }: ExecArgs): Promise<void> {
  const pack = samplesPackArg(args)
  try {
    await planSampleLoad(container, pack)
  } catch (error) {
    const refusal = refusalOf(error)
    if (!refusal) {
      throw error
    }
    print({ status: refusal })
    if (refusal === "unknown_samples") {
      process.exitCode = 1
    }
    return
  }
  const { result } = await loadSampleCatalogWorkflow(container).run({ input: { pack } })
  // No staff member, no request: the admin log does not see it
  await container.resolve<AuditLogModuleService>(AUDIT_LOG_MODULE).record({
    kind: "system",
    action: "sample_catalog.loaded",
    actor_type: "system",
    actor_id: null,
    resource_type: "sample_catalog",
    resource_id: pack,
    outcome: 200,
    changes: { pack, products: result.products },
  })
  print({
    status: "loaded",
    pack: result.pack,
    products: result.products,
    categories_made: result.categories_made,
    categories_opened: result.categories_opened,
  })
}
