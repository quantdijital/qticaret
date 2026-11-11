import { isLoopbackUrl } from "@qticaret/server-kit"

/**
 * Why `CP_LOCAL_PG_ADMIN_URL` may not be used, or null (C10 review L4): a
 * postgres URL to this machine, with no query string or fragment. The pg
 * driver reads connection settings from the query (`host=`, `sslmode=`…),
 * which could send the connection elsewhere than the host checked here.
 * The answer never names the URL.
 */
export function localAdminUrlProblem(value: string): string | null {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return "must be a postgres:// URL"
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    return "must be a postgres:// URL"
  }
  if (url.search !== "" || url.hash !== "" || value.includes("?") || value.includes("#")) {
    return "must have no query string or fragment"
  }
  let here: boolean
  try {
    here = isLoopbackUrl(value)
  } catch {
    here = false
  }
  return here ? null : "must point at a database on this machine"
}
