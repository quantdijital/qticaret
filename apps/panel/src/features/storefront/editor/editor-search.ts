/**
 * The theme editor's address: `?open=preferences` opens the storefront's
 * preferences panel at first (the old Storefront > Preferences page's
 * links land there); anything else is left out.
 */
export const editorSearch = (search: Record<string, unknown>): { open?: "preferences" } =>
  search["open"] === "preferences" ? { open: "preferences" } : {}
