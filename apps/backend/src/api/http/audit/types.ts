/** The request's container, as far as a snapshot needs it. */
export interface Resolver {
  resolve(key: string): unknown
}

export interface GraphQuery {
  graph: (config: {
    entity: string
    fields: string[]
    filters: Record<string, unknown>
  }) => Promise<{ data: unknown[] }>
}

export type Snapshot = Record<string, unknown>

export interface SnapshotInput {
  scope: Resolver
  /** Named groups of the route pattern, decoded. */
  params: Record<string, string>
  body: unknown
}

export interface AuditedResource {
  method: string
  /** The route pattern written as the action (`POST /admin/products/:id`). */
  route: string
  pattern: RegExp
  resourceType: string
  resourceId: (params: Record<string, string>) => string | null
  snapshot: (input: SnapshotInput) => Promise<Snapshot>
  /** Fields whose values are never written: only "changed" and the last 4 characters. */
  sensitive?: readonly string[]
}

// Medusa IDs: a prefix and a ULID (`prod_01J...`); "batch" and other words are not IDs
export const ID = "[a-z]+_[0-9A-Za-z]+"
