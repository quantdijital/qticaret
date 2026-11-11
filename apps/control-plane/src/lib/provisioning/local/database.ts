import { ModulesSdkUtils } from "@medusajs/framework/utils"
import { ProvisioningError } from "../provisioner"

/**
 * A local shop's database on the dev Postgres (adr/0061 §6.3, Ek C10):
 * `qt_tenant_<slug>` owned by its own role of the same name, which can log
 * in and nothing else (no superuser, no new databases or roles, no
 * replication), and no one else may connect to it. Made through the
 * administrative URL (`CP_LOCAL_PG_ADMIN_URL`), used for this alone.
 *
 * DDL takes no bind parameters: names and the password go into the
 * statement, so each is checked against a strict pattern first (a name is
 * the slug's; the password is 64 hex characters, `generateRuntimeSecrets`).
 */

interface Sql {
  raw: (sql: string, bindings?: readonly unknown[]) => Promise<{ rows: Record<string, unknown>[] }>
  destroy: () => Promise<void>
}

const NAME = /^qt_tenant_[a-z][a-z0-9_]{2,40}$/
const PASSWORD = /^[0-9a-f]{64}$/

function checked(name: string, password?: string): string {
  if (!NAME.test(name) || (password !== undefined && !PASSWORD.test(password))) {
    throw new ProvisioningError("provisioning.database_name_invalid")
  }
  return `"${name}"`
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
    // A driver error may quote the statement, and a statement may hold the
    // password: only a code leaves here
    throw error instanceof ProvisioningError
      ? error
      : new ProvisioningError("provisioning.database_failed")
  } finally {
    await sql.destroy()
  }
}

const exists = async (sql: Sql, query: string, name: string) =>
  (await sql.raw(query, [name])).rows.length > 0

export interface DatabaseState {
  database: boolean
  role: boolean
}

/** Whether the shop's database and role exist. */
export async function databaseState(adminUrl: string, name: string): Promise<DatabaseState> {
  checked(name)
  return await withAdmin(adminUrl, async (sql) => ({
    database: await exists(sql, "SELECT 1 FROM pg_database WHERE datname = ?", name),
    role: await exists(sql, "SELECT 1 FROM pg_roles WHERE rolname = ?", name),
  }))
}

/**
 * The role (made, or its password set to the store's again) and the
 * database it owns, made if missing. What this call made comes back.
 */
export async function ensureDatabase(
  adminUrl: string,
  name: string,
  password: string
): Promise<{ database: boolean; role: boolean }> {
  const quoted = checked(name, password)
  return await withAdmin(adminUrl, async (sql) => {
    const role = !(await exists(sql, "SELECT 1 FROM pg_roles WHERE rolname = ?", name))
    const limits = "NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS"
    await sql.raw(
      `${role ? "CREATE" : "ALTER"} ROLE ${quoted} LOGIN ${limits} CONNECTION LIMIT 40 PASSWORD '${password}'`
    )
    const database = !(await exists(sql, "SELECT 1 FROM pg_database WHERE datname = ?", name))
    if (database) {
      await sql.raw(`CREATE DATABASE ${quoted} OWNER ${quoted} TEMPLATE template0 ENCODING 'UTF8'`)
    }
    // No one else connects: Postgres gives every role CONNECT on a new database
    await sql.raw(`REVOKE ALL ON DATABASE ${quoted} FROM PUBLIC`)
    await sql.raw(`GRANT CONNECT, TEMPORARY ON DATABASE ${quoted} TO ${quoted}`)
    return { database, role }
  })
}

/** The shop's database (its connections ended first) and its role, if they exist. */
export async function dropDatabase(adminUrl: string, name: string): Promise<void> {
  const quoted = checked(name)
  await withAdmin(adminUrl, async (sql) => {
    await sql.raw(`DROP DATABASE IF EXISTS ${quoted} WITH (FORCE)`)
    await sql.raw(`DROP ROLE IF EXISTS ${quoted}`)
  })
}
