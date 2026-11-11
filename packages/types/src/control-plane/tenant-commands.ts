import { z } from "zod"

/**
 * What the provisioner reads back from a shop's commands (adr/0061 §3.4,
 * §5.7, Ek C10). A command prints at most one result line on stdout:
 * `TENANT_RESULT_PREFIX` and a JSON object; everything else it prints is
 * its log. The provisioner reads only that line, and never keeps or logs
 * it: `tenant:invite-owner`'s carries the owner's invitation link.
 */
export const TENANT_RESULT_PREFIX = "QT_TENANT_RESULT "

/** The result line's longest form; a longer line is not read. */
export const TENANT_RESULT_MAX_LENGTH = 8 * 1024

/** `tenant:invite-owner email=`: a new invitation, or none because the shop already has staff. */
export const inviteOwnerResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("invited"), link: z.string().min(1).max(4096) }).strict(),
  z.object({ status: z.literal("owner_exists") }).strict(),
  // The address already has a user here: made outside the setup, it is not invited again
  z.object({ status: z.literal("address_taken") }).strict(),
])
export type InviteOwnerResult = z.infer<typeof inviteOwnerResultSchema>

/** `tenant:plan-import` (the first document, from stdin): as the push endpoint answers. */
export const planImportResultSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.enum(["applied", "same"]),
      serial: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    })
    .strict(),
  z.object({ status: z.literal("refused"), code: z.string().min(1).max(100) }).strict(),
  z.object({ status: z.literal("unmanaged") }).strict(),
])
export type PlanImportResult = z.infer<typeof planImportResultSchema>

/** The line a command prints for `result`. */
export const tenantResultLine = (result: object): string =>
  `${TENANT_RESULT_PREFIX}${JSON.stringify(result)}`

/**
 * The result line in a command's stdout, parsed (the last one wins);
 * null when there is none, it is too long or it is not a JSON object.
 */
export function readTenantResult(stdout: string): unknown {
  const lines = stdout.split(/\r?\n/).filter((line) => line.startsWith(TENANT_RESULT_PREFIX))
  const line = lines.at(-1)
  if (line === undefined || line.length > TENANT_RESULT_MAX_LENGTH) {
    return null
  }
  try {
    const parsed: unknown = JSON.parse(line.slice(TENANT_RESULT_PREFIX.length))
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}
