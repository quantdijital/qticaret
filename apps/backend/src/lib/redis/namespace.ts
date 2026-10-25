/**
 * A tenant's name for keys in a shared Redis: its database server and name.
 * Tenants that share a Redis (instance-per-tenant, one database each), and
 * local dev and test runs on one Redis, must not see each other's keys.
 */
export function tenantNamespace(databaseUrl: string): string {
  const url = new URL(databaseUrl)
  const raw = url.pathname.slice(1)
  let name = raw
  try {
    name = decodeURIComponent(raw)
  } catch {
    // A malformed escape is kept as written rather than failing
  }
  return `${url.hostname}:${url.port || "5432"}/${name || "default"}`
}
