import type { Context } from "@medusajs/framework/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaError,
  MedusaService,
  generateEntityId,
} from "@medusajs/framework/utils"
import type Redis from "ioredis"
import { createRedisVersionSource, createVersionedCache } from "../../lib/cache"
import type { VersionedCache } from "../../lib/cache"
import { createRedisClient } from "../../lib/redis"
import type { StaffRole as Role } from "../../lib/staff"
import { StaffRole } from "./models/staff-role"

interface Options {
  redisUrl?: string
  versionKey?: string
}

interface Executor {
  execute: (sql: string, params: unknown[]) => Promise<unknown>
}

// Staff are a handful; the whole table is held
const MAX_STAFF = 10_000

/**
 * Staff roles (F12.6, adr/0040), read on every admin request: held in
 * process and reloaded when any process changes one (a role taken away
 * holds no longer than a second, adr/0012). The shop keeps one owner at
 * least; the first user of a shop with none becomes it.
 */
class StaffRolesModuleService extends MedusaService({ StaffRole }) {
  private readonly cache: VersionedCache<ReadonlyMap<string, Role>>

  constructor(container: Record<string, unknown>, options: Options = {}) {
    // eslint-disable-next-line prefer-rest-params -- MedusaService needs every constructor argument
    super(...arguments)
    const { redisUrl } = options
    let client: Redis | undefined
    const source = redisUrl
      ? createRedisVersionSource(
          () => (client ??= createRedisClient(redisUrl, "staff_roles")),
          options.versionKey ?? "qt:staff-roles:version"
        )
      : null
    this.cache = createVersionedCache({
      name: "staff_roles",
      source,
      load: () => this.loadRoles_(),
    })
  }

  @InjectManager()
  protected async loadRoles_(
    @MedusaContext() sharedContext: Context = {}
  ): Promise<ReadonlyMap<string, Role>> {
    const rows = await this.listStaffRoles(
      {},
      { select: ["user_id", "role"], take: MAX_STAFF },
      sharedContext
    )
    return new Map(rows.map((row) => [row.user_id, row.role]))
  }

  /**
   * A user's role, or null for one without (removed, or made outside the
   * panel): they reach nothing. A shop with no staff yet makes its first
   * user owner.
   */
  async roleOf(userId: string): Promise<Role | null> {
    const roles = await this.cache.get()
    const role = roles.get(userId)
    if (role) {
      return role
    }
    if (roles.size > 0) {
      return null
    }
    const claimed = await this.claimFirstOwner_(userId)
    await this.cache.invalidate()
    return claimed ? "owner" : ((await this.cache.get()).get(userId) ?? null)
  }

  /** The roles of several users at once (the team list). */
  async rolesOf(userIds: readonly string[]): Promise<Map<string, Role>> {
    const roles = await this.cache.get()
    return new Map(
      userIds.flatMap((id) => {
        const role = roles.get(id)
        return role ? [[id, role] as const] : []
      })
    )
  }

  /**
   * Whether the shop has any staff member yet (the setup's owner
   * invitation, adr/0061 §5.7): read from the table, not the held copy, as
   * it decides who may become owner.
   */
  @InjectManager()
  async hasStaff(@MedusaContext() sharedContext: Context = {}): Promise<boolean> {
    const rows = await this.listStaffRoles({}, { select: ["id"], take: 1 }, sharedContext)
    return rows.length > 0
  }

  /**
   * The setup's owner invitation accepted (adr/0061 Ek C10): the user
   * becomes owner only while the shop still has no staff, under the same
   * lock as the first-user rule. False when someone came first.
   */
  async claimBootstrapOwner(userId: string): Promise<boolean> {
    const claimed = await this.claimFirstOwner_(userId)
    await this.cache.invalidate()
    return claimed
  }

  /** The first user of a shop without staff becomes its owner; one at a time. */
  @InjectTransactionManager()
  protected async claimFirstOwner_(
    userId: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<boolean> {
    const manager = sharedContext.transactionManager as Executor
    await manager.execute(`SELECT pg_advisory_xact_lock(hashtext('staff_role:first_owner'))`, [])
    const rows = (await manager.execute(
      `INSERT INTO staff_role (id, user_id, role, assigned_by, created_at, updated_at)
       SELECT ?, ?, 'owner', NULL, now(), now()
        WHERE NOT EXISTS (SELECT 1 FROM staff_role WHERE deleted_at IS NULL)
       RETURNING id`,
      [generateEntityId(undefined, "strole"), userId]
    )) as unknown[]
    return rows.length > 0
  }

  /** Gives a user a role. The shop's last owner keeps theirs (`staff.last_owner`). */
  async setRole(userId: string, role: Role, assignedBy: string | null): Promise<void> {
    await this.setRole_(userId, role, assignedBy)
    await this.cache.invalidate()
  }

  /** A user leaves the staff; the last owner cannot. */
  async removeRole(userId: string): Promise<void> {
    await this.removeRole_(userId)
    await this.cache.invalidate()
  }

  // Owners locked first: two changes at once never leave the shop without one
  private async lockOwners(manager: Executor): Promise<string[]> {
    const rows = (await manager.execute(
      `SELECT user_id FROM staff_role WHERE role = 'owner' AND deleted_at IS NULL FOR UPDATE`,
      []
    )) as { user_id: string }[]
    return rows.map((row) => row.user_id)
  }

  @InjectTransactionManager()
  protected async setRole_(
    userId: string,
    role: Role,
    assignedBy: string | null,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    const manager = sharedContext.transactionManager as Executor
    const owners = await this.lockOwners(manager)
    if (role !== "owner" && owners.length === 1 && owners[0] === userId) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "staff.last_owner")
    }
    await manager.execute(
      `INSERT INTO staff_role (id, user_id, role, assigned_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, now(), now())
       ON CONFLICT (user_id) WHERE deleted_at IS NULL
       DO UPDATE SET role = EXCLUDED.role, assigned_by = EXCLUDED.assigned_by, updated_at = now()`,
      [generateEntityId(undefined, "strole"), userId, role, assignedBy]
    )
  }

  @InjectTransactionManager()
  protected async removeRole_(
    userId: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    const manager = sharedContext.transactionManager as Executor
    const owners = await this.lockOwners(manager)
    if (owners.length === 1 && owners[0] === userId) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "staff.last_owner")
    }
    await manager.execute(`DELETE FROM staff_role WHERE user_id = ?`, [userId])
  }
}

export default StaffRolesModuleService
