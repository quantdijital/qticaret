/**
 * Reads a required environment variable; throws at startup when it is missing
 * so the server never runs with an insecure fallback (docs/04).
 * F0.6 replaces this with a Zod-validated env schema.
 */
export function requireEnv(name: string): string {
  const value = process.env[name]
  if (value === undefined || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}
