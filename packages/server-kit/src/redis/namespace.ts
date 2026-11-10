/**
 * A tenant's name for keys in a shared Redis: its database server and name.
 * Tenants that share a Redis (instance-per-tenant, one database each), and
 * local dev and test runs on one Redis, must not see each other's keys.
 * Medusa's test runner works in databases of its own but leaves
 * DATABASE_URL as the env file has it, often dev's: a test run
 * (`NODE_ENV=test`) is named apart, or its sign-ups would use up dev's
 * login limit. An integration test file is named apart from every other
 * (`testRun`, QT_TEST_RUN in integration-tests/setup.js): two runs at once
 * on one machine would otherwise wait on each other's locks (a fixed key
 * like `catalog:successors`) and read each other's cache versions.
 */
export function tenantNamespace(databaseUrl: string, nodeEnv?: string, testRun?: string): string {
  const url = new URL(databaseUrl)
  const raw = url.pathname.slice(1)
  let name = raw
  try {
    name = decodeURIComponent(raw)
  } catch {
    // A malformed escape is kept as written rather than failing
  }
  const namespace = `${url.hostname}:${url.port || "5432"}/${name || "default"}`
  if (nodeEnv !== "test") {
    return namespace
  }
  return testRun ? `${namespace}/test/${testRun}` : `${namespace}/test`
}
