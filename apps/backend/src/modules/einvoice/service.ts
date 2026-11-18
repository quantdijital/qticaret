import type { Context } from "@medusajs/framework/types"
import { InjectTransactionManager, MedusaContext } from "@medusajs/framework/utils"
import { decryptPii, encryptPii, parseKey } from "@qticaret/server-kit"
import { isProviderError } from "../../lib/errors"
import { InvoiceBirfaturaService } from "./birfatura"

export { MAX_ATTEMPTS } from "./queue"
export type { WrittenBack } from "./records"
export type { PullableInvoice } from "./birfatura"
export type {
  ClaimedInvoice,
  DocumentType,
  InvoiceKind,
  InvoiceProgress,
  InvoiceProviderId,
  InvoiceStatus,
  IssuedInvoice,
  QueuedInvoice,
} from "./queue"

export interface EinvoiceModuleOptions {
  /** PII_ENCRYPTION_KEY: the Paraşüt tokens are kept with it. */
  encryptionKey: string
}

export interface ParasutTokenPair {
  accessToken: string
  refreshToken: string
  expiresAt: Date
}

/** Why no call can be made: nothing connected, or Paraşüt refused the connection since. */
export type ParasutAccessProblem =
  | "einvoice.parasut_not_connected"
  | "einvoice.parasut_disconnected"
  | "einvoice.parasut_refresh_unknown"

interface StoredConnection {
  id: string
  company_id: string
  access_token_encrypted: string
  refresh_token_encrypted: string
  access_expires_at: Date
  status: "connected" | "broken"
}

interface Executor {
  execute: (sql: string, params: unknown[]) => Promise<unknown>
}

// Refusals that mean the shop took its company back. `invalid_client` is the platform's own
// client refused: every shop's would break with it, so it is thrown, the connections left as they are
const REVOKED = new Set(["invalid_grant", "unauthorized"])
// A refresh whose answer was lost: Paraşüt may have turned the refresh token over already
const UNSURE = new Set(["outcome_unknown", "invalid_response", "response_too_large"])

/** Orders' invoices (F8, adr/0034), and the shop's Paraşüt connection (§5). */
class EinvoiceModuleService extends InvoiceBirfaturaService {
  private readonly encryptionKey: Buffer

  constructor(container: Record<string, unknown>, options: EinvoiceModuleOptions) {
    // eslint-disable-next-line prefer-rest-params -- MedusaService needs every constructor argument
    super(...arguments)
    this.encryptionKey = parseKey(options.encryptionKey, "einvoice encryptionKey")
  }

  private seal(companyId: string, kind: "access" | "refresh", value: string): string {
    return encryptPii(value, this.encryptionKey, `parasut:${companyId}:${kind}`)
  }

  private unseal(companyId: string, kind: "access" | "refresh", value: string): string {
    return decryptPii(value, this.encryptionKey, `parasut:${companyId}:${kind}`)
  }

  /** The connection as the panel shows it: never a token. */
  async parasutConnection() {
    const [row] = await this.listParasutConnections({ slot: "parasut" }, { take: 1 })
    return row
      ? {
          company_id: row.company_id,
          status: row.status,
          last_error: row.last_error,
          connected_by: row.connected_by,
          connected_at: row.connected_at,
          checked_at: row.checked_at,
        }
      : null
  }

  /**
   * Connects the shop's company, or connects it again (a new code, or
   * another company). The row before, for a compensation.
   */
  async saveParasutConnection(input: {
    company_id: string
    tokens: ParasutTokenPair
    by: string | null
  }) {
    const [previous] = await this.listParasutConnections({ slot: "parasut" }, { take: 1 })
    const values = {
      company_id: input.company_id,
      access_token_encrypted: this.seal(input.company_id, "access", input.tokens.accessToken),
      refresh_token_encrypted: this.seal(input.company_id, "refresh", input.tokens.refreshToken),
      access_expires_at: input.tokens.expiresAt,
      status: "connected" as const,
      last_error: null,
      connected_by: input.by,
      connected_at: new Date(),
      checked_at: new Date(),
    }
    if (previous) {
      await this.updateParasutConnections({ id: previous.id, ...values })
    } else {
      await this.createParasutConnections(values)
    }
    return previous ?? null
  }

  /** Puts back the row a connection replaced (or removes the one it made). */
  async restoreParasutConnection(previous: Awaited<ReturnType<typeof this.saveParasutConnection>>) {
    const [current] = await this.listParasutConnections({ slot: "parasut" }, { take: 1 })
    if (!previous) {
      if (current) {
        await this.deleteParasutConnections(current.id)
      }
      return
    }
    const values = {
      company_id: previous.company_id,
      access_token_encrypted: previous.access_token_encrypted,
      refresh_token_encrypted: previous.refresh_token_encrypted,
      access_expires_at: previous.access_expires_at,
      status: previous.status,
      last_error: previous.last_error,
      connected_by: previous.connected_by,
      connected_at: previous.connected_at,
      checked_at: previous.checked_at,
    }
    if (current) {
      await this.updateParasutConnections({ id: current.id, ...values })
    } else {
      await this.createParasutConnections(values)
    }
  }

  /** Forgets the connection and its tokens for good. Whether there was one. */
  async removeParasutConnection(): Promise<boolean> {
    const [row] = await this.listParasutConnections({ slot: "parasut" }, { take: 1 })
    if (row) {
      await this.deleteParasutConnections(row.id)
    }
    return Boolean(row)
  }

  /** Keeps a connection check's outcome: a code, or null when Paraşüt answered. */
  async recordParasutCheck(code: string | null, at: Date = new Date()): Promise<void> {
    const [row] = await this.listParasutConnections({ slot: "parasut" }, { take: 1 })
    if (row) {
      await this.updateParasutConnections({ id: row.id, last_error: code, checked_at: at })
    }
  }

  /**
   * An access token for a call: the stored one while it lives; otherwise
   * `refresh` trades the refresh token for a new pair under the row's lock,
   * so two processes never spend the same refresh token, and the pair is
   * kept. `refused` is a token Paraşüt turned away before its time (taken
   * back): it is refreshed too, unless another process already did. A
   * refresh Paraşüt refuses leaves the connection broken.
   */
  @InjectTransactionManager()
  async parasutAccess(
    refresh: (refreshToken: string) => Promise<ParasutTokenPair>,
    options: { now?: Date; refused?: string } = {},
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ company_id: string; token: string } | { problem: ParasutAccessProblem }> {
    const now = options.now ?? new Date()
    const manager = sharedContext.transactionManager as Executor
    const [row] = (await manager.execute(
      `SELECT id, company_id, access_token_encrypted, refresh_token_encrypted, access_expires_at, status
         FROM parasut_connection WHERE slot = 'parasut' AND deleted_at IS NULL FOR UPDATE`,
      []
    )) as StoredConnection[]
    if (!row) {
      return { problem: "einvoice.parasut_not_connected" }
    }
    if (row.status === "broken") {
      return { problem: "einvoice.parasut_disconnected" }
    }
    const stored = this.unseal(row.company_id, "access", row.access_token_encrypted)
    if (new Date(row.access_expires_at) > now && stored !== options.refused) {
      return { company_id: row.company_id, token: stored }
    }
    let tokens: ParasutTokenPair
    try {
      tokens = await refresh(this.unseal(row.company_id, "refresh", row.refresh_token_encrypted))
    } catch (error) {
      if (isProviderError(error) && UNSURE.has(error.providerCode)) {
        // Kept so the panel can say why the next refresh may be refused
        await manager.execute(
          `UPDATE parasut_connection SET last_error = 'refresh_outcome_unknown', updated_at = now() WHERE id = ?`,
          [row.id]
        )
        return { problem: "einvoice.parasut_refresh_unknown" }
      }
      if (!isProviderError(error) || !REVOKED.has(error.providerCode)) {
        throw error
      }
      await manager.execute(
        `UPDATE parasut_connection SET status = 'broken', last_error = ?, updated_at = now() WHERE id = ?`,
        [error.providerCode, row.id]
      )
      return { problem: "einvoice.parasut_disconnected" }
    }
    await manager.execute(
      `UPDATE parasut_connection
          SET access_token_encrypted = ?, refresh_token_encrypted = ?, access_expires_at = ?,
              updated_at = now()
        WHERE id = ?`,
      [
        this.seal(row.company_id, "access", tokens.accessToken),
        this.seal(row.company_id, "refresh", tokens.refreshToken),
        tokens.expiresAt,
        row.id,
      ]
    )
    return { company_id: row.company_id, token: tokens.accessToken }
  }
}

export default EinvoiceModuleService
