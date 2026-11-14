import { readFileSync } from "node:fs"
import type { z } from "zod"

/** A pack that does not read as one: its code, file and what is wrong. */
export class SectorPackError extends Error {
  constructor(message: string) {
    super(`sector pack: ${message}`)
    this.name = "SectorPackError"
  }
}

/** A path inside a file as an issue names it (`home.0.category_ids`). */
export const pathText = (path: readonly PropertyKey[]): string => path.map(String).join(".")

/**
 * One of a pack's JSON files read and checked with its frame schema;
 * `where` names it in the error (`general/presets/grafit/layout.json`).
 */
export function readJsonFile<S extends z.ZodType>(
  path: string,
  where: string,
  schema: S
): z.infer<S> {
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(path, "utf8"))
  } catch {
    throw new SectorPackError(`${where} is not JSON`)
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    throw new SectorPackError(`${where} ${pathText(issue?.path ?? [])}: ${issue?.message ?? ""}`)
  }
  return parsed.data
}
