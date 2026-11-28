import { controlPlaneVersion } from "../../lib/fleet/control-plane-release"
import { compareVersions, sameRelease } from "../../lib/fleet/releases"
import { ProvisioningError } from "../../lib/provisioning/provisioner"
import { provisioner } from "../../lib/provisioning/provider"
import { fleetIn, provisioningIn } from "../modules"

const HEARTBEAT_MS = 60_000
import { provisionStep } from "./step"
import { contextOf } from "./target"

/**
 * A shop's backup and its move to its target release (audit 3.1, 3.2).
 * The backup is the platform's tool (`infra/backup/backup.sh`, through the
 * provisioner); its summary is the step's output, so the shop's latest
 * backup is read from its runs (no copy elsewhere).
 */

/** "Şimdi yedekle", and the upgrade's first act: never undone (a backup harms nothing). */
export const backupStep = provisionStep("backup", async (input, container) => {
  const { target } = await contextOf(container, input.tenant_id)
  // Review M1: a long backup keeps its run alive, so no second run opens beside it
  const beat = setInterval(() => {
    void provisioningIn(container)
      .heartbeat(input.run_id)
      .catch(() => undefined)
  }, HEARTBEAT_MS)
  let taken
  try {
    taken = await provisioner().backup(target)
  } finally {
    clearInterval(beat)
  }
  return {
    status: "succeeded",
    created: false,
    output: {
      manifest: taken.manifest,
      taken_at: taken.taken_at,
      seconds: taken.seconds,
      bytes: taken.bytes,
      dump_sha256: taken.dump_sha256,
      files: taken.files,
    },
  }
})

/**
 * 1. Whether the shop may move to its target (audit 3.1):
 *
 * - it has one (`provisioning.no_target_release`)
 * - the target is not newer than the control plane (adr/0061 Ek C21: the
 *   control plane first, then the shops: an older control plane refuses
 *   a newer shop's report). The other direction (C16/C20: the shops first,
 *   then the control plane) is the control plane's own deploy gate (F16,
 *   audit 4.8): upgrading a shop is always that order's first half.
 * - this provisioner can start the shop on it (local: the compiled
 *   backend's stamp is the target; `provisioning.release_not_built`)
 * - the shop runs (`provisioning.shop_not_running`): one stopped on
 *   purpose is started by hand, never by an upgrade
 */
export const releaseStep = provisionStep("release", async (input, container) => {
  const { target } = await contextOf(container, input.tenant_id)
  const fleet = fleetIn(container)
  const [targets, reports] = await Promise.all([
    fleet.targetsOf([target.tenant_id]),
    fleet.latestReports([target.tenant_id]),
  ])
  const wanted = targets.get(target.tenant_id)?.release ?? null
  if (!wanted) {
    throw new ProvisioningError("provisioning.no_target_release")
  }
  const own = controlPlaneVersion()
  if (own === null) {
    throw new ProvisioningError("provisioning.control_plane_release_unknown")
  }
  if (compareVersions(wanted.version, own) > 0) {
    throw new ProvisioningError("provisioning.release_ahead_of_control_plane")
  }
  // Review L3: a shop stopped on purpose is not brought up by an upgrade
  if (!(await provisioner().probe(target)).running) {
    throw new ProvisioningError("provisioning.shop_not_running")
  }
  const built = await provisioner().availableRelease(target)
  if (!built || !sameRelease(built, wanted)) {
    throw new ProvisioningError("provisioning.release_not_built")
  }
  const reported = reports.get(target.tenant_id) ?? null
  return {
    status: "succeeded",
    created: false,
    output: {
      from: reported ? reported.version : null,
      from_commit: reported ? reported.commit.slice(0, 12) : null,
      to: wanted.version,
      to_commit: wanted.commit.slice(0, 12),
    },
  }
})

/**
 * 3. The shop stopped for its migrations. Not undone (review M2): locally
 * every shop runs the one build, already the target, so a start after a
 * failed migration would run the new code on a half-migrated database. A
 * failure leaves the shop stopped with the failed step's code; the backup
 * taken just before is the way back (runbook), "Başlat" the way forward.
 */
export const upgradeStopStep = provisionStep(
  // Its own name: the run kinds' steps are told apart on the run's page
  "upgrade_stop",
  async (input, container) => {
    const { target } = await contextOf(container, input.tenant_id)
    if (!(await provisioner().probe(target)).running) {
      return { status: "skipped", created: false, output: { running: false } }
    }
    await provisioner().stop(target)
    return { status: "succeeded", created: false, output: { running: false } }
  }
)

/** 5. Started on the new release; not undone (a failed health check leaves it up, said why). */
export const upgradeStartStep = provisionStep("upgrade_start", async (input, container) => {
  const { target } = await contextOf(container, input.tenant_id)
  if ((await provisioner().probe(target)).running) {
    return { status: "skipped", created: false, output: { running: true } }
  }
  await provisioner().start(target)
  return { status: "succeeded", created: false, output: { port: target.port } }
})
