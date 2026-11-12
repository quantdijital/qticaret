import type { Context } from "@medusajs/framework/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaError,
  MedusaService,
  generateEntityId,
} from "@medusajs/framework/utils"
import type { CpStaffRole } from "../../lib/staff/roles"
import { GRANT_REFUSED, grantHolds } from "./grant"
import type { GrantRow } from "./grant"
import { CpStaffMember } from "./models/cp-staff-member"

interface Executor {
  execute: (sql: string, params: unknown[]) => Promise<unknown>
}

export interface MemberState {
  role: CpStaffRole
  /** Not deactivated. */
  active: boolean
  /** Waiting for their first factor: the deadline, else null. */
  enrolBy: Date | null
  enrolTokenHash: string | null
  bootstrap: boolean
  mfaValidAfter: Date | null
  tokensValidAfter: Date | null
}

// Granted owners: not deactivated, not waiting for their 2FA
const ACTIVE_OWNERS = `SELECT user_id FROM cp_staff_member
  WHERE role = 'owner' AND deactivated_at IS NULL AND enrol_by IS NULL
    AND deleted_at IS NULL FOR UPDATE`

const FIELDS = [
  "user_id",
  "role",
  "deactivated_at",
  "enrol_by",
  "enrol_token_hash",
  "bootstrap",
  "mfa_valid_after",
  "tokens_valid_after",
] as const

const asDate = (value: unknown): Date | null =>
  value === null || value === undefined ? null : new Date(value as string)

/**
 * Platform staff roles (adr/0061 §3.5; the shop's staff-roles module,
 * copied without its cache: a handful of staff, one indexed row per
 * request, never stale). Nobody becomes owner by being first: the first
 * owner comes from `cp:create-owner`. A role is granted once the member's
 * first factor is confirmed (`activate`). The control plane keeps one
 * granted owner at least (`cp.last_owner`). Each member's credential marks
 * (`mfa_valid_after`, `tokens_valid_after`) end what came before them.
 */
class CpStaffModuleService extends MedusaService({ CpStaffMember }) {
  /** A user's staff state; null for a user who is not staff. */
  @InjectManager()
  async memberOf(
    userId: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<MemberState | null> {
    const [row] = await this.listCpStaffMembers(
      { user_id: userId },
      { select: [...FIELDS], take: 1 },
      sharedContext
    )
    return row
      ? {
          role: row.role,
          active: row.deactivated_at === null,
          enrolBy: asDate(row.enrol_by),
          enrolTokenHash: row.enrol_token_hash,
          bootstrap: row.bootstrap,
          mfaValidAfter: asDate(row.mfa_valid_after),
          tokensValidAfter: asDate(row.tokens_valid_after),
        }
      : null
  }

  /** The role of a granted, active member; null for anyone else. */
  async roleOf(userId: string): Promise<CpStaffRole | null> {
    const member = await this.memberOf(userId)
    return member?.active && member.enrolBy === null ? member.role : null
  }

  /** Several users at once (the staff list). */
  @InjectManager()
  async membersOf(
    userIds: readonly string[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<Map<string, { role: CpStaffRole; active: boolean; pending: boolean }>> {
    if (userIds.length === 0) {
      return new Map()
    }
    const rows = await this.listCpStaffMembers(
      { user_id: [...userIds] },
      { select: [...FIELDS], take: userIds.length },
      sharedContext
    )
    return new Map(
      rows.map((row) => [
        row.user_id,
        { role: row.role, active: row.deactivated_at === null, pending: row.enrol_by !== null },
      ])
    )
  }

  /** Whether the control plane has a granted, active owner. */
  @InjectManager()
  async hasActiveOwner(@MedusaContext() sharedContext: Context = {}): Promise<boolean> {
    // A handful of owners at most; read and checked here rather than by a null filter
    const owners = await this.listCpStaffMembers(
      { role: "owner" },
      { select: ["deactivated_at", "enrol_by"], take: 100 },
      sharedContext
    )
    return owners.some((owner) => owner.deactivated_at === null && owner.enrol_by === null)
  }

  /** Changes a member's role (granted at once). The last granted owner keeps theirs. */
  @InjectTransactionManager()
  async setRole(
    userId: string,
    role: CpStaffRole,
    assignedBy: string | null,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    const manager = sharedContext.transactionManager as Executor
    await this.refuseLastOwner(manager, userId, role !== "owner")
    await manager.execute(
      `INSERT INTO cp_staff_member (id, user_id, role, assigned_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, now(), now())
       ON CONFLICT (user_id) WHERE deleted_at IS NULL
       DO UPDATE SET role = EXCLUDED.role, assigned_by = EXCLUDED.assigned_by, updated_at = now()`,
      [generateEntityId(undefined, "cpstf"), userId, role, assignedBy]
    )
  }

  /**
   * A new member from an invitation, pending until their first factor is
   * confirmed by `enrolBy`. A bootstrap owner only while no owner is granted
   * (checked under the owners' lock).
   */
  @InjectTransactionManager()
  async addPending(
    userId: string,
    role: CpStaffRole,
    input: { assignedBy: string | null; bootstrap: boolean; enrolBy: Date },
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    const manager = sharedContext.transactionManager as Executor
    const owners = (await manager.execute(ACTIVE_OWNERS, [])) as unknown[]
    if (input.bootstrap && owners.length > 0) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "cp.owner_exists")
    }
    await manager.execute(
      `INSERT INTO cp_staff_member
         (id, user_id, role, assigned_by, enrol_by, bootstrap, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, now(), now())`,
      [
        generateEntityId(undefined, "cpstf"),
        userId,
        role,
        input.assignedBy,
        input.enrolBy,
        input.bootstrap,
      ]
    )
  }

  /**
   * Whether the member's first factor may grant their role now (`grantHolds`),
   * read without the lock: the verify route asks before it confirms anything;
   * `activate` decides under the lock.
   */
  @InjectManager()
  async mayGrant(userId: string, @MedusaContext() sharedContext: Context = {}): Promise<boolean> {
    const [row] = await this.listCpStaffMembers(
      { user_id: userId },
      { select: [...FIELDS, "assigned_by"], take: 1 },
      sharedContext
    )
    const owners = await this.listCpStaffMembers(
      { role: "owner" },
      { select: ["user_id", "deactivated_at", "enrol_by"], take: 100 },
      sharedContext
    )
    const granted = owners
      .filter((owner) => owner.deactivated_at === null && owner.enrol_by === null)
      .map((owner) => owner.user_id)
    return grantHolds(row, granted)
  }

  /**
   * The member's first factor is confirmed: the role is granted, the
   * enrolment token spent, and 2FA from before this no longer counts. A
   * bootstrap owner is granted only while no other owner is; an invited
   * owner only while whoever gave the role still is one (`grantHolds`),
   * under the owners' lock, so a demotion cannot slip in between.
   */
  @InjectTransactionManager()
  async activate(userId: string, @MedusaContext() sharedContext: Context = {}): Promise<void> {
    const manager = sharedContext.transactionManager as Executor
    const owners = (await manager.execute(ACTIVE_OWNERS, [])) as { user_id: string }[]
    const [row] = (await manager.execute(
      `SELECT role, bootstrap, assigned_by, enrol_by, enrol_token_hash FROM cp_staff_member
        WHERE user_id = ? AND deleted_at IS NULL FOR UPDATE`,
      [userId]
    )) as GrantRow[]
    if (row?.bootstrap && owners.some((owner) => owner.user_id !== userId)) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "cp.owner_exists")
    }
    const granted = owners.map((owner) => owner.user_id)
    if (!grantHolds(row, granted)) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, GRANT_REFUSED)
    }
    await manager.execute(
      `UPDATE cp_staff_member SET enrol_by = NULL, enrol_token_hash = NULL, bootstrap = false,
         mfa_valid_after = now(), updated_at = now()
        WHERE user_id = ? AND deleted_at IS NULL`,
      [userId]
    )
  }

  /**
   * After a 2FA reset: the member waits for a new factor, through the
   * e-mailed token, by `enrolBy`; every sign-in and token before ends. Not
   * the last granted owner.
   */
  @InjectTransactionManager()
  async requireEnrolment(
    userId: string,
    tokenHash: string,
    enrolBy: Date,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    const manager = sharedContext.transactionManager as Executor
    await this.refuseLastOwner(manager, userId, true)
    await manager.execute(
      `UPDATE cp_staff_member SET enrol_by = ?, enrol_token_hash = ?, mfa_valid_after = now(),
         tokens_valid_after = now(), updated_at = now()
        WHERE user_id = ? AND deleted_at IS NULL`,
      [enrolBy, tokenHash, userId]
    )
  }

  /** Ends what the member's sign-ins proved so far: 2FA turned off or changed (H1). */
  @InjectTransactionManager()
  async endMfa(userId: string, @MedusaContext() sharedContext: Context = {}): Promise<void> {
    const manager = sharedContext.transactionManager as Executor
    await manager.execute(
      `UPDATE cp_staff_member SET mfa_valid_after = now(), tokens_valid_after = now(),
         updated_at = now() WHERE user_id = ? AND deleted_at IS NULL`,
      [userId]
    )
  }

  /** Every bearer token the member holds stops (their sessions are ended by id). */
  @InjectTransactionManager()
  async endTokens(userId: string, @MedusaContext() sharedContext: Context = {}): Promise<void> {
    const manager = sharedContext.transactionManager as Executor
    await manager.execute(
      `UPDATE cp_staff_member SET tokens_valid_after = now(), updated_at = now()
        WHERE user_id = ? AND deleted_at IS NULL`,
      [userId]
    )
  }

  /** Takes a member's access away and ends their tokens; the last granted owner cannot. */
  @InjectTransactionManager()
  async deactivate(userId: string, @MedusaContext() sharedContext: Context = {}): Promise<void> {
    const manager = sharedContext.transactionManager as Executor
    await this.refuseLastOwner(manager, userId, true)
    await manager.execute(
      `UPDATE cp_staff_member SET deactivated_at = now(), tokens_valid_after = now(),
         updated_at = now()
        WHERE user_id = ? AND deleted_at IS NULL AND deactivated_at IS NULL`,
      [userId]
    )
  }

  /** Access back with the role they had; nothing from before comes back with it. */
  @InjectTransactionManager()
  async reactivate(userId: string, @MedusaContext() sharedContext: Context = {}): Promise<void> {
    const manager = sharedContext.transactionManager as Executor
    await manager.execute(
      `UPDATE cp_staff_member SET deactivated_at = NULL, tokens_valid_after = now(),
         mfa_valid_after = now(), updated_at = now()
        WHERE user_id = ? AND deleted_at IS NULL`,
      [userId]
    )
  }

  /**
   * Removes a member's row: only an acceptance undone (compensation), whose
   * member is the one it just made. No route calls it.
   */
  @InjectTransactionManager()
  async removeMember(userId: string, @MedusaContext() sharedContext: Context = {}): Promise<void> {
    const manager = sharedContext.transactionManager as Executor
    await manager.execute(`DELETE FROM cp_staff_member WHERE user_id = ?`, [userId])
  }

  // Granted owners locked first: two changes at once never leave the control plane without one
  private async refuseLastOwner(manager: Executor, userId: string, losing: boolean) {
    const owners = (await manager.execute(ACTIVE_OWNERS, [])) as { user_id: string }[]
    if (losing && owners.length === 1 && owners[0]?.user_id === userId) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "cp.last_owner")
    }
  }
}

export default CpStaffModuleService
