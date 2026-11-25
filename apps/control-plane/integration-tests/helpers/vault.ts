import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

interface Knex {
  raw: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>
}

/**
 * Every table of the test database whose rows hold any of `needles`
 * (Ek C8: no secret in plaintext anywhere at rest). Each row as JSON text;
 * a hit names the table, never the value.
 */
export async function tablesHolding(
  container: MedusaContainer,
  needles: readonly string[]
): Promise<string[]> {
  const pg = container.resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION)
  const { rows: tables } = await pg.raw(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'`
  )
  const hits: string[] = []
  for (const { table_name } of tables) {
    const { rows } = await pg.raw(`SELECT * FROM "${String(table_name)}"`)
    const text = JSON.stringify(rows)
    if (needles.some((needle) => text.includes(needle))) {
      hits.push(String(table_name))
    }
  }
  return hits
}

const LOGGER_METHODS = ["info", "warn", "error", "debug", "log"] as const

/**
 * What the process writes to stdout and stderr while `run` runs, and,
 * given the container, every line its logger is handed: where the logger
 * writes (a console jest silences in CI, a stream) does not decide whether
 * a test sees the line, so "logged" and "not logged" are both checked.
 */
export async function captureOutput<T>(
  run: () => Promise<T>,
  container?: MedusaContainer
): Promise<{ result: T; output: string }> {
  const chunks: string[] = []
  const spies: { mockRestore: () => void }[] = [process.stdout, process.stderr].map((stream) => {
    const write = stream.write.bind(stream)
    return jest.spyOn(stream, "write").mockImplementation((chunk: unknown, ...rest: unknown[]) => {
      chunks.push(String(chunk))
      return (write as (...args: unknown[]) => boolean)(chunk, ...rest)
    })
  })
  const logger = container?.resolve<Record<string, unknown>>(ContainerRegistrationKeys.LOGGER)
  for (const method of LOGGER_METHODS) {
    const original = logger?.[method]
    if (logger && typeof original === "function") {
      spies.push(
        jest.spyOn(logger, method as never).mockImplementation(((...args: unknown[]) => {
          chunks.push(
            `${args.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg))).join(" ")}\n`
          )
          return (original as (...args: unknown[]) => unknown).apply(logger, args)
        }) as never)
      )
    }
  }
  try {
    const result = await run()
    return { result, output: chunks.join("") }
  } finally {
    for (const spy of spies) {
      spy.mockRestore()
    }
  }
}

/** The forms a secret could leak in: as stored, as hex and as base64. */
export function formsOf(value: string): string[] {
  const forms = [value]
  if (/^[A-Za-z0-9_-]{43}$/.test(value)) {
    const raw = Buffer.from(value, "base64url")
    forms.push(raw.toString("hex"), raw.toString("base64").replace(/=+$/, ""))
  }
  return forms
}
