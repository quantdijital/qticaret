/**
 * A Sentry-style DSN, as GlitchTip gives one (adr/0045):
 * `https://<public key>@<host>[/<path>]/<project id>`. The public key only
 * lets a client send events; it reads nothing. Plain http is accepted for
 * a loopback address only (a collector on the same machine).
 */
export interface ErrorTrackingDsn {
  dsn: string
  publicKey: string
  /** Where envelopes go: `/api/<project id>/envelope/`. */
  envelopeUrl: string
}

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"])

export function parseDsn(value: string): ErrorTrackingDsn | null {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  const secure = url.protocol === "https:"
  if (!secure && !(url.protocol === "http:" && LOOPBACK.has(url.hostname))) {
    return null
  }
  const segments = url.pathname.split("/").filter(Boolean)
  const project = segments.pop()
  if (!url.username || !project || !/^\d+$/.test(project)) {
    return null
  }
  const base = segments.length > 0 ? `/${segments.join("/")}` : ""
  return {
    dsn: value,
    publicKey: decodeURIComponent(url.username),
    envelopeUrl: `${url.protocol}//${url.host}${base}/api/${project}/envelope/`,
  }
}
