import { readdirSync, statSync } from "node:fs"
import { join } from "node:path"

// The local file provider's folder in tests (no object store in CI)
export const STATIC_DIR = join(process.cwd(), "static")

/** Files the local file provider wrote whose name matches, in every folder under `dir`. */
export function filesNamed(pattern: RegExp, dir = STATIC_DIR): string[] {
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch (error) {
    // No folder yet: nothing written there
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return []
    }
    throw error
  }
  return names.flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory()
      ? filesNamed(pattern, path)
      : pattern.test(name)
        ? [path]
        : []
  })
}
