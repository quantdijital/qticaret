import { createHash } from "node:crypto"
import { MedusaService } from "@medusajs/framework/utils"
import { decryptPii, encryptPii, hashPii, parseKey } from "../../lib/crypto/pii"
import { uniqueViolationKeys } from "../../lib/errors"
import type { LegalKind } from "../../lib/legal/tokens"
import { CookieConsent } from "./models/cookie-consent"
import { LegalConsent } from "./models/legal-consent"
import type { AcceptedDocument } from "./models/legal-consent"
import { LegalDocument } from "./models/legal-document"
import type { LegalStatus } from "./models/legal-document"
import { LegalOrderCopy } from "./models/legal-order-copy"

export { LEGAL_STATUSES } from "./models/legal-document"
export type { LegalStatus } from "./models/legal-document"
export type { AcceptedDocument } from "./models/legal-consent"

export interface LegalModuleOptions {
  /** PII_ENCRYPTION_KEY: the shopper's IP and the order's copies are encrypted with it. */
  encryptionKey: string
  /** PII_HASH_KEY: a visitor is known by this hash of their cookie, never the cookie itself. */
  hashKey: string
}

export interface CookieChoice {
  analytics: boolean
  marketing: boolean
  policy_version: number | null
}

export interface OrderCopyInput {
  order_id: string
  kind: LegalKind
  version: number
  document_id: string
  title: string
  html: string
}

const ipContext = (cartId: string) => `legal.consent.ip:${cartId}`
const copyContext = (orderId: string, kind: string) => `legal.copy:${orderId}:${kind}`
const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex")

/** The shop's legal texts, their versions and the consents given to them (F13, adr/0041). */
class LegalModuleService extends MedusaService({
  LegalDocument,
  LegalConsent,
  LegalOrderCopy,
  CookieConsent,
}) {
  private readonly encryptionKey: Buffer
  private readonly hashKey: Buffer

  constructor(container: Record<string, unknown>, options: LegalModuleOptions) {
    // eslint-disable-next-line prefer-rest-params -- MedusaService needs every constructor argument
    super(...arguments)
    this.encryptionKey = parseKey(options.encryptionKey, "legal encryptionKey")
    this.hashKey = parseKey(options.hashKey, "legal hashKey")
  }

  private visitorHash(visitorId: string): string {
    return hashPii(visitorId, this.hashKey, "legal.visitor")
  }

  /** Keeps the visitor's answer to the cookie banner beside the ones before. */
  async recordCookieConsent(visitorId: string, choice: CookieChoice) {
    return this.createCookieConsents({
      visitor_hash: this.visitorHash(visitorId),
      ...choice,
      given_at: new Date(),
    })
  }

  /** The visitor's answer in force: the latest; null when they never answered. */
  async latestCookieConsent(visitorId: string) {
    return this.latestOfHash(this.visitorHash(visitorId))
  }

  /**
   * The answer in force now for the visitor who gave this one: a cart's
   * consent may have been withdrawn before the order was placed.
   */
  async currentCookieConsent(consentId: string) {
    const [given] = await this.listCookieConsents(
      { id: consentId },
      { take: 1, select: ["visitor_hash"] }
    )
    return given ? this.latestOfHash(given.visitor_hash) : null
  }

  private async latestOfHash(visitorHash: string) {
    const [latest] = await this.listCookieConsents(
      { visitor_hash: visitorHash },
      { take: 1, order: { given_at: "DESC" } }
    )
    return latest ?? null
  }

  /** The kind's version in a state (its draft, its published text), or null. */
  async versionOf(kind: LegalKind, status: Exclude<LegalStatus, "retired">) {
    const [row] = await this.listLegalDocuments({ kind, status }, { take: 1 })
    return row ?? null
  }

  /** The number the kind's next version takes; a dropped draft's number is taken again. */
  async nextVersion(kind: LegalKind): Promise<number> {
    const [last] = await this.listLegalDocuments(
      { kind },
      { take: 1, order: { version: "DESC" }, select: ["version"] }
    )
    return (last?.version ?? 0) + 1
  }

  /** Records what the shopper accepted for the cart; the last answer replaces the one before. */
  async recordConsent(cartId: string, documents: AcceptedDocument[], ip: string | null) {
    const values = {
      documents: documents as unknown as Record<string, unknown>,
      ip_encrypted: ip ? encryptPii(ip, this.encryptionKey, ipContext(cartId)) : null,
      given_at: new Date(),
    }
    const replace = async () => {
      const [existing] = await this.listLegalConsents({ cart_id: cartId }, { take: 1 })
      return existing ? this.updateLegalConsents({ id: existing.id, ...values }) : null
    }
    const replaced = await replace()
    if (replaced) {
      return replaced
    }
    try {
      return await this.createLegalConsents({ cart_id: cartId, ...values })
    } catch (error) {
      // Two answers at once: the one stored first is replaced by this one
      const again = uniqueViolationKeys(error)?.includes("cart_id") ? await replace() : null
      if (!again) {
        throw error
      }
      return again
    }
  }

  /** The IP address the consent was given from; null when none was seen. */
  ipOf(consent: { cart_id: string; ip_encrypted: string | null }): string | null {
    return consent.ip_encrypted
      ? decryptPii(consent.ip_encrypted, this.encryptionKey, ipContext(consent.cart_id))
      : null
  }

  /**
   * Keeps the order's copy of a contract once: a copy already kept is
   * returned as it is, never replaced.
   */
  async keepOrderCopy(input: OrderCopyInput): Promise<{ id: string; created: boolean }> {
    const [existing] = await this.listLegalOrderCopies(
      { order_id: input.order_id, kind: input.kind },
      { take: 1, select: ["id"] }
    )
    if (existing) {
      return { id: existing.id, created: false }
    }
    try {
      const created = await this.createLegalOrderCopies({
        order_id: input.order_id,
        kind: input.kind,
        version: input.version,
        document_id: input.document_id,
        title: input.title,
        html_encrypted: encryptPii(
          input.html,
          this.encryptionKey,
          copyContext(input.order_id, input.kind)
        ),
        html_hash: sha256(input.html),
      })
      return { id: created.id, created: true }
    } catch (error) {
      if (!uniqueViolationKeys(error)?.includes("order_id")) {
        throw error
      }
      return this.keepOrderCopy(input)
    }
  }

  /** The order's copy of a contract, its HTML checked against the hash it was kept with. */
  async readOrderCopy(orderId: string, kind: LegalKind) {
    const [row] = await this.listLegalOrderCopies({ order_id: orderId, kind }, { take: 1 })
    if (!row) {
      return null
    }
    const html = decryptPii(row.html_encrypted, this.encryptionKey, copyContext(orderId, kind))
    return {
      kind,
      version: row.version,
      title: row.title,
      html,
      html_hash: row.html_hash,
      intact: sha256(html) === row.html_hash,
      created_at: new Date(row.created_at).toISOString(),
    }
  }
}

export default LegalModuleService
