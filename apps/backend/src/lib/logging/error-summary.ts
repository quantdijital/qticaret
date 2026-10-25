/**
 * An error's name and message only, for logs where the error's own fields
 * could carry personal data: ioredis errors carry the command (a key with a
 * client IP), database errors the values they refused. A workflow hands
 * errors back as plain objects; their name, message or i18n key is read too.
 */
export function errorSummary(error: unknown): { name?: string; message: string } {
  if (error instanceof Error) {
    return { name: error.name, message: error.message }
  }
  if (error !== null && typeof error === "object") {
    const fields = error as { name?: unknown; message?: unknown; safeMessage?: unknown }
    const text = (value: unknown) => (typeof value === "string" ? value : undefined)
    const name = text(fields.name)
    return {
      ...(name ? { name } : {}),
      message: text(fields.message) ?? text(fields.safeMessage) ?? "unknown error",
    }
  }
  return { message: String(error) }
}
