import type { Context } from "@medusajs/framework/types"
import { InjectManager, MedusaContext, MedusaError, MedusaService } from "@medusajs/framework/utils"
import { decryptPii, detectTaxIdKind, encryptPii, hashPii, parseKey } from "@qticaret/server-kit"
import { BillingProfile } from "./models/billing-profile"
import type { BillingProfileInput, BillingProfileModuleOptions } from "./types"

/** Domain separation for the tax id's ciphertext and hash (adr/0009). */
const TAX_ID_CONTEXT = "billing_profile.tax_id"
/**
 * Ciphertexts are bound to their customer as associated data, so one copied
 * onto another customer's profile fails to decrypt instead of putting the
 * wrong number on an invoice.
 */
const encryptionContext = (customerId: string) => `${TAX_ID_CONTEXT}:${customerId}`
const CURRENT_KEY_VERSION = 1

export interface ProtectedProfileData {
  type: BillingProfileInput["type"]
  legal_name: string
  tax_office: string | null
  tax_id_kind: "tckn" | "vkn"
  tax_id_encrypted: string
  tax_id_hash: string
  tax_id_last4: string
  key_version: number
}

class BillingProfileModuleService extends MedusaService({ BillingProfile }) {
  private readonly encryptionKey: Buffer
  private readonly hashKey: Buffer

  constructor(container: Record<string, unknown>, options: BillingProfileModuleOptions) {
    // eslint-disable-next-line prefer-rest-params -- MedusaService needs every constructor argument
    super(...arguments)
    this.encryptionKey = parseKey(options.encryptionKey, "billingProfile encryptionKey")
    this.hashKey = parseKey(options.hashKey, "billingProfile hashKey")
  }

  /**
   * Validates a submitted profile and returns what may be stored: the tax id
   * encrypted, hashed and reduced to its last four digits. Individuals need a
   * TCKN; corporates a VKN, or a TCKN for sole proprietorships, plus a tax
   * office. Error messages never contain the tax id.
   *
   * Call it where the plaintext enters (the API route), so workflows only
   * ever carry the protected form.
   */
  prepareProfileData(input: BillingProfileInput, customerId: string): ProtectedProfileData {
    const taxId = input.tax_id.replace(/\s+/g, "")
    const kind = detectTaxIdKind(taxId)
    const taxOffice = input.tax_office?.trim() ?? ""
    if (!kind || (input.type === "individual" && kind !== "tckn")) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "billing_profile.tax_id_invalid")
    }
    if (input.type === "corporate" && !taxOffice) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "billing_profile.tax_office_required")
    }
    return {
      type: input.type,
      legal_name: input.legal_name.trim(),
      tax_office: taxOffice || null,
      tax_id_kind: kind,
      tax_id_encrypted: encryptPii(taxId, this.encryptionKey, encryptionContext(customerId)),
      tax_id_hash: this.hashTaxId(taxId),
      tax_id_last4: taxId.slice(-4),
      key_version: CURRENT_KEY_VERSION,
    }
  }

  hashTaxId(taxId: string): string {
    return hashPii(taxId.replace(/\s+/g, ""), this.hashKey, TAX_ID_CONTEXT)
  }

  /**
   * Plaintext tax id, for the e-invoice step only (F8). Reading it must also
   * be written to the audit log once F2.5 exists; never return it from an API.
   */
  @InjectManager()
  async revealTaxId(
    id: string,
    customerId: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<string> {
    const profile = await this.retrieveBillingProfile(
      id,
      { select: ["tax_id_encrypted", "key_version"] },
      sharedContext
    )
    if (profile.key_version !== CURRENT_KEY_VERSION) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "unknown billing profile key version"
      )
    }
    return decryptPii(profile.tax_id_encrypted, this.encryptionKey, encryptionContext(customerId))
  }
}

export default BillingProfileModuleService
