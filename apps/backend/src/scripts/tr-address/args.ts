import type { ImportTrAddressInput } from "../../workflows/tr-address/import-tr-address"

/**
 * The import command's arguments. `medusa exec` refuses `--options` it does
 * not know, so plain words are the sure form; the `--` spellings are taken
 * too, for when they get through:
 *
 * - `source=turkiyeapi` (or `--source turkiyeapi`, `--source=turkiyeapi`):
 *   the whole country from TürkiyeAPI; `if-changed` skips a dataset the
 *   shop has already;
 * - a `.csv` / `.json` path: a file (adr/0008), `deactivate-missing` marks
 *   what it lacks inactive (a complete national file only).
 */
export type ImportArgs = Omit<ImportTrAddressInput, "actor_id" | "job_id">

const SOURCES = ["turkiyeapi", "file"] as const
const flag = (args: readonly string[], name: string) =>
  args.includes(name) || args.includes(`--${name}`)

export function parseImportArgs(args: readonly string[]): ImportArgs {
  let source: string | undefined
  const rest: string[] = []
  for (let index = 0; index < args.length; index++) {
    const arg = args[index] ?? ""
    const inline = /^(?:--)?source=(.*)$/.exec(arg)
    if (inline) {
      source = inline[1]
    } else if (arg === "--source" || arg === "source") {
      source = args[++index]
    } else {
      rest.push(arg)
    }
  }
  const filePath = rest.find((arg) => !arg.startsWith("-") && /\.(csv|json)$/i.test(arg))
  source ??= filePath ? "file" : undefined
  if (!source || !(SOURCES as readonly string[]).includes(source)) {
    throw new Error(
      "tr-address import: pass source=turkiyeapi, or the data file's path (.csv or .json)"
    )
  }
  if (source === "file") {
    if (!filePath) {
      throw new Error("tr-address import: pass the data file's path (.csv or .json)")
    }
    return {
      source: "file",
      file_path: filePath,
      deactivate_missing: flag(rest, "deactivate-missing"),
    }
  }
  return { source: "turkiyeapi", only_if_changed: flag(rest, "if-changed") }
}
