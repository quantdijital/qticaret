/** `?kaynak=paket`: the bundle our team prepared, offered only from its own link. */
export const migrationSearch = (search: Record<string, unknown>): { kaynak?: "paket" } =>
  search["kaynak"] === "paket" ? { kaynak: "paket" } : {}
