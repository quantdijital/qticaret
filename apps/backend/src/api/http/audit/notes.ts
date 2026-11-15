/**
 * What a handler may add to its audit entry through `res.locals`
 * (adr/0011): the id of the record it made, for a route without one in
 * its path, and a small summary of what it did (counts, never personal
 * data). `mutations.ts` reads them when it writes the entry.
 */
export const AUDIT_RESOURCE_ID = "audit_resource_id"
export const AUDIT_RESULT = "audit_result"
