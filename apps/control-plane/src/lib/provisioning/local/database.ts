import { ModulesSdkUtils } from "@medusajs/framework/utils"
import { tenantIdSchema } from "@qticaret/types/control-plane"
import { ProvisioningError } from "../provisioner"
import { SCRAM_VERIFIER, scramVerifier } from "./scram"

/**
 * A local shop's database on the dev Postgres (adr/0061 §6.3, Ek C10):
 * `qt_tenant_<slug>` owned by its own role of the same name, which can log
 * in and nothing else (no superuser, no new databases or roles, no
 * replication), and no one else may connect to it. Made through the
 * administrative URL (`CP_LOCAL_PG_ADMIN_URL`), used for this alone.
 *
 * - Both carry the shop's id as their comment (review L1): a database or
 *   role with another shop's mark, or none, is never taken over and never
 *   dropped (`provisioning.foreign_shop`).
 * - The password goes in as a SCRAM-SHA-256 verifier made here (review
 *   L2): the plaintext never reaches the server.
 * - DDL takes no bind parameters: names, ids and the verifier are checked
 *   against strict patterns before they go into a statement.
 */

interface Sql {
  raw: (sql: string, bindings?: readonly unknown[]) => Promise<{ rows: Record<string, unknown>[] }>
  destroy: () => Promise<void>
}

const NAME = /^qt_tenant_[a-z][a-z0-9_]{2,40}$/
const PASSWORD = /^[0-9a-f]{64}$/

function quoted(name: string): string {
  if (!NAME.test(name)) {
    throw new ProvisioningError("provisioning.database_name_invalid")
  }
  return `"${name}"`
}

function mark(tenantId: string): string {
  if (!tenantIdSchema.safeParse(tenantId).success) {
    throw new ProvisioningError("provisioning.database_name_invalid")
  }
  return `'${tenantId}'`
}

async function withAdmin<T>(adminUrl: string, work: (sql: Sql) => Promise<T>): Promise<T> {
  const sql = ModulesSdkUtils.createPgConnection({
    clientUrl: adminUrl,
    schema: "public",
    pool: { min: 0, max: 1 },
  }) as unknown as Sql
  try {
    return await work(sql)
  } catch (error) {
    // A driver error may quote the statement: only a code leaves here
    throw error instanceof ProvisioningError
      ? error
      : new ProvisioningError("provisioning.database_failed")
  } finally {
    await sql.destroy()
  }
}

/** What exists under the name: absent, or present with its mark (null: unmarked). */
type Found = { exists: false } | { exists: true; mark: string | null }

async function found(sql: Sql, kind: "database" | "role", name: string): Promise<Found> {
  const query =
    kind === "database"
      ? "SELECT shobj_description(oid, 'pg_database') AS mark FROM pg_database WHERE datname = ?"
      : "SELECT shobj_description(oid, 'pg_authid') AS mark FROM pg_roles WHERE rolname = ?"
  const [row] = (await sql.raw(query, [name])).rows
  return row ? { exists: true, mark: (row["mark"] as string | null) ?? null } : { exists: false }
}

const ours = (thing: Found, tenantId: string) => !thing.exists || thing.mark === tenantId

/**
 * The role (made, or its password set to the store's again) and the
 * database it owns, made if missing, each marked with the shop's id. What
 * this call made comes back; another shop's (or an unmarked) one is refused.
 */
export async function ensureDatabase(
  adminUrl: string,
  name: string,
  password: string,
  tenantId: string
): Promise<{ database: boolean; role: boolean }> {
  const ident = quoted(name)
  const comment = mark(tenantId)
  if (!PASSWORD.test(password)) {
    throw new ProvisioningError("provisioning.database_name_invalid")
  }
  const verifier = scramVerifier(password)
  if (!SCRAM_VERIFIER.test(verifier)) {
    throw new ProvisioningError("provisioning.database_failed")
  }
  return await withAdmin(adminUrl, async (sql) => {
    const role = await found(sql, "role", name)
    const database = await found(sql, "database", name)
    if (!ours(role, tenantId) || !ours(database, tenantId)) {
      throw new ProvisioningError("provisioning.foreign_shop")
    }
    const limits = "NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS"
    await sql.raw(
      `${role.exists ? "ALTER" : "CREATE"} ROLE ${ident} LOGIN ${limits} CONNECTION LIMIT 40 PASSWORD '${verifier}'`
    )
    await sql.raw(`COMMENT ON ROLE ${ident} IS ${comment}`)
    if (!database.exists) {
      await sql.raw(`CREATE DATABASE ${ident} OWNER ${ident} TEMPLATE template0 ENCODING 'UTF8'`)
      await sql.raw(`COMMENT ON DATABASE ${ident} IS ${comment}`)
    }
    // No one else connects: Postgres gives every role CONNECT on a new database
    await sql.raw(`REVOKE ALL ON DATABASE ${ident} FROM PUBLIC`)
    await sql.raw(`GRANT CONNECT, TEMPORARY ON DATABASE ${ident} TO ${ident}`)
    return { database: !database.exists, role: !role.exists }
  })
}

/**
 * The shop's database (its connections ended first) and its role, each only
 * if it carries this shop's mark: anything else is left as it is.
 */
export async function dropDatabase(
  adminUrl: string,
  name: string,
  tenantId: string
): Promise<void> {
  const ident = quoted(name)
  mark(tenantId)
  await withAdmin(adminUrl, async (sql) => {
    const database = await found(sql, "database", name)
    const role = await found(sql, "role", name)
    if (
      (database.exists && database.mark !== tenantId) ||
      (role.exists && role.mark !== tenantId)
    ) {
      throw new ProvisioningError("provisioning.foreign_shop")
    }
    if (database.exists) {
      await sql.raw(`DROP DATABASE ${ident} WITH (FORCE)`)
    }
    if (role.exists) {
      await sql.raw(`DROP ROLE ${ident}`)
    }
  })
}
