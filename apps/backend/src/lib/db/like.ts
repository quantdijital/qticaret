/** A value matched literally by `LIKE`/`ILIKE`: `_` and `%` are wildcards there, and e-mail addresses carry `_`. */
export const likeLiteral = (value: string): string =>
  value.replace(/[\\%_]/g, (char) => `\\${char}`)
