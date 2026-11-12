import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { releaseList } from "../../../../lib/fleet/release-views"
import type { ReleaseRecord } from "../../../../modules/fleet/service-releases"
import { addReleaseWorkflow } from "../../../../workflows/fleet/releases"
import { noteAuditChanges, noteAuditResource } from "../../../http/audit"
import { actorOf } from "../tenants/params"
import { staffNames } from "../tenants/views"
import type { PostReleaseType } from "./validators"

const VERSION_TAKEN = "cp.release_version_taken"

/**
 * GET /admin/cp/releases (all staff; Ek C18): the releases, newest first,
 * each with how many shops report running it and how many target it, and
 * who added it. No personal data beyond staff names.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const releases = await releaseList(req.scope)
  const names = await staffNames(
    req,
    releases.map((release) => release.created_by)
  )
  res.setHeader("Cache-Control", "no-store")
  res.json({
    releases: releases.map((release) => ({
      ...release,
      created_by: release.created_by ? (names[release.created_by] ?? null) : null,
    })),
  })
}

/**
 * POST /admin/cp/releases (owner, operator, step-up; Ek C18): a release
 * the platform knows: version, commit, an optional note. 409
 * `cp.release_version_taken` for a known version. The note is free text:
 * the audit row has its length only.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<PostReleaseType>,
  res: MedusaResponse
): Promise<void> {
  const { version, commit, notes } = req.validatedBody
  let result: ReleaseRecord
  try {
    result = (
      await addReleaseWorkflow(req.scope).run({
        input: { version, commit, notes: notes ?? null, created_by: actorOf(req) },
      })
    ).result
  } catch (error) {
    // Medusa's handler words a conflict its own way: the key is said here (as Ek C16's)
    if ((error as { message?: unknown } | null)?.message === VERSION_TAKEN) {
      res.status(409).json({ type: "conflict", message: VERSION_TAKEN })
      return
    }
    throw error
  }
  noteAuditResource(req, result.id)
  noteAuditChanges(req, {
    version: { to: version },
    commit: { to: commit },
    notes: { length: notes?.length ?? 0 },
  })
  res.json({ release: { ...result, reported_count: 0, target_count: 0 } })
}
