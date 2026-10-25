/**
 * An error's name and message only, for logs where the error's own fields
 * could carry personal data: ioredis errors carry the command (a key with a
 * client IP), database errors the values they refused.
 */
export const errorSummary = (error: unknown) =>
  error instanceof Error ? { name: error.name, message: error.message } : { message: String(error) }
