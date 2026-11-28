/** `?kaynak=paket`: the bundle our team prepared, offered only from its own link. */
export const migrationSearch = (search: Record<string, unknown>): { kaynak?: "paket" } =>
  search["kaynak"] === "paket" ? { kaynak: "paket" } : {}

// A job's id as the server makes it
const JOB_ID = /^ajob_[0-9A-Za-z]{1,40}$/

/** The wizard's search: the team's bundle, and `?is=<job>` to open a finished transfer's result. */
export const migrationWizardSearch = (
  search: Record<string, unknown>
): { kaynak?: "paket"; is?: string } => {
  const is = search["is"]
  return {
    ...migrationSearch(search),
    ...(typeof is === "string" && JOB_ID.test(is) ? { is } : {}),
  }
}
