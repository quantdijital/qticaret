/**
 * Medusa Admin, kept for the platform team until the panel covers every
 * job (adr/0022 §3). Same host in production; the backend's own port in
 * development, where this panel runs on Vite's.
 */
export function advancedPanelUrl(path: string): string {
  const base = import.meta.env.DEV ? "http://localhost:9000/app" : "/app"
  return `${base}${path}`
}
