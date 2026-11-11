/**
 * Why `value` may not be where a local shop reaches the control plane
 * (`CP_LOCAL_CONTROL_PLANE_URL`, Ek C13): an `http` base URL on this
 * machine only, nothing more; null when it may.
 */
export function localControlPlaneUrlProblem(value: string): string | null {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return "invalid"
  }
  const base =
    url.protocol === "http:" &&
    url.username === "" &&
    url.password === "" &&
    url.search === "" &&
    url.hash === "" &&
    url.pathname === "/"
  return base && ["localhost", "127.0.0.1"].includes(url.hostname) ? null : "not_local"
}
