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
import { CpStaffMember } from "./models/cp-staff-member"

interface Executor {
  execute: (sql: string, params: unknown[]) => Promise<unknown>
}

export interface MemberState {
  role: CpStaffRole
  active: boolean
}

const ACTIVE_OWNERS = `SELECT user_id FROM cp_staff_member
  WHERE role = 'owner' AND deactivated_at IS NULL AND deleted_at IS NULL FOR UPDATE`

/**
 * Platform staff roles (adr/0061 §3.5; the shop's staff-roles module,
 * copied without its cache: a handful of staff, one indexed row per
 * request, never stale). Unlike a shop, nobody becomes owner by being
 * first: the first owner comes from `cp:create-owner`. The control plane
 * keeps one active owner at least (`cp.last_owner`).
 */
class CpStaffModuleService extends MedusaService({ CpStaffMember }) {
  /** A user's role and whether it is active; null for a user who is not staff. */
  @InjectManager()
  async memberOf(
    userId: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<MemberState | null> {
    const [row] = await this.listCpStaffMembers(
      { user_id: userId },
      { select: ["role", "deactivated_at"], take: 1 },
      sharedContext
    )
    return row ? { role: row.role, active: row.deactivated_at === null } : null
  }

  /** The role of an active member; null for anyone else: they reach nothing. */
  async roleOf(userId: string): Promise<CpStaffRole | null> {
    const member = await this.memberOf(userId)
    return member?.active ? member.role : null
  }

  /** Several users at once (the staff list). */
  @InjectManager()
  async membersOf(
    userIds: readonly string[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<Map<string, MemberState>> {
    if (userIds.length === 0) {
      return new Map()
    }
    const rows = await this.listCpStaffMembers(
      { user_id: [...userIds] },
      { select: ["user_id", "role", "deactivated_at"], take: userIds.length },
      sharedContext
    )
    return new Map(
      rows.map((row) => [row.user_id, { role: row.role, active: row.deactivated_at === null }])
    )
  }

  /** Whether the control plane has an active owner (`cp:create-owner` runs only without one). */
  @InjectManager()
  async hasActiveOwner(@MedusaContext() sharedContext: Context = {}): Promise<boolean> {
    // A handful of owners at most; read and checked here rather than by a null filter
    const owners = await this.listCpStaffMembers(
      { role: "owner" },
      { select: ["deactivated_at"], take: 100 },
      sharedContext
    )
    return owners.some((owner) => owner.deactivated_at === null)
  }

  /** Gives a user a role (a new member's, or a change). The last active owner keeps theirs. */
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

  /** Takes a member's access away; the last active owner cannot lose theirs. */
  @InjectTransactionManager()
  async deactivate(userId: string, @MedusaContext() sharedContext: Context = {}): Promise<void> {
    const manager = sharedContext.transactionManager as Executor
    await this.refuseLastOwner(manager, userId, true)
    await manager.execute(
      `UPDATE cp_staff_member SET deactivated_at = now(), updated_at = now()
        WHERE user_id = ? AND deleted_at IS NULL AND deactivated_at IS NULL`,
      [userId]
    )
  }

  /** Gives a deactivated member their access back, with the role they had. */
  @InjectTransactionManager()
  async reactivate(userId: string, @MedusaContext() sharedContext: Context = {}): Promise<void> {
    const manager = sharedContext.transactionManager as Executor
    await manager.execute(
      `UPDATE cp_staff_member SET deactivated_at = NULL, updated_at = now()
        WHERE user_id = ? AND deleted_at IS NULL`,
      [userId]
    )
  }

  /**
   * Removes a member's row: only an acceptance undone (compensation), whose
   * member is the one it just made, a bootstrapped owner included. No route
   * calls it: members leave by deactivation.
   */
  @InjectTransactionManager()
  async removeMember(userId: string, @MedusaContext() sharedContext: Context = {}): Promise<void> {
    const manager = sharedContext.transactionManager as Executor
    await manager.execute(`DELETE FROM cp_staff_member WHERE user_id = ?`, [userId])
  }

  // Active owners locked first: two changes at once never leave the control plane without one
  private async refuseLastOwner(manager: Executor, userId: string, losing: boolean) {
    const owners = (await manager.execute(ACTIVE_OWNERS, [])) as { user_id: string }[]
    if (losing && owners.length === 1 && owners[0]?.user_id === userId) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "cp.last_owner")
    }
  }
}

export default CpStaffModuleService
