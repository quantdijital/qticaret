import { MedusaService } from "@medusajs/framework/utils"
import type { LegalKind } from "../../lib/legal/tokens"
import { LegalDocument } from "./models/legal-document"
import type { LegalStatus } from "./models/legal-document"

export { LEGAL_STATUSES } from "./models/legal-document"
export type { LegalStatus } from "./models/legal-document"

/** The shop's legal texts and their versions (F13.1, adr/0041 §1). */
class LegalModuleService extends MedusaService({ LegalDocument }) {
  /** The kind's version in a state (its draft, its published text), or null. */
  async versionOf(kind: LegalKind, status: Exclude<LegalStatus, "retired">) {
    const [row] = await this.listLegalDocuments({ kind, status }, { take: 1 })
    return row ?? null
  }

  /** The number the kind's next version takes. */
  async nextVersion(kind: LegalKind): Promise<number> {
    const [last] = await this.listLegalDocuments(
      { kind },
      { take: 1, order: { version: "DESC" }, select: ["version"], withDeleted: true }
    )
    return (last?.version ?? 0) + 1
  }
}

export default LegalModuleService
