/**
 * What of the audit log the shop's panel shows (docs/06 principle 10): the
 * shop's own records. The platform operator's (the address reference
 * data's imports, adr/0008 Ek 2026-11-04) stay in the log, read from the
 * database and the CLI; the viewer, its filter and its export leave them out.
 */
export const PLATFORM_RESOURCE_TYPES: readonly string[] = ["tr_address"]

/** Whether a resource type is the shop's to see. */
export const isShopResource = (type: string): boolean => !PLATFORM_RESOURCE_TYPES.includes(type)

/**
 * The filter for the shop's entries, joined under `$and`: an entry naming
 * no resource (a refused request) is the shop's too.
 */
export const SHOP_ENTRIES = {
  $or: [{ resource_type: null }, { resource_type: { $nin: [...PLATFORM_RESOURCE_TYPES] } }],
}
