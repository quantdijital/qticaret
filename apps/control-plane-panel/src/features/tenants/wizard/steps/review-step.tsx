import { useQuery } from "@tanstack/react-query"
import { Pencil, TriangleAlert } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Alert, AlertDescription, AlertTitle } from "@qticaret/admin-ui/ui/alert"
import { Button } from "@qticaret/admin-ui/ui/button"
import type { Plan } from "@/features/packages/api"
import { priceText } from "@/features/packages/format"
import {
  chosenPreset,
  packName,
  sampleProductsOf,
  sectorPacksQuery,
} from "@/features/sector-packs/api"
import { compact } from "@/features/tenants/company-rules"
import { domainOf, missingCompanyFields, slugOf } from "../draft"
import type { ShopDraft, WizardStep } from "../draft"
import type { SetupProgress } from "../setup-sequence"
import { SetupProgressList } from "./setup-progress"

const COMPANY_LABELS: Record<string, string> = {
  legal_name: "company.legalName",
  tax_office: "company.taxOffice",
  tax_number: "company.taxNumber",
  tckn: "company.tckn",
  address_line: "company.addressLine",
  city: "company.city",
}

/** `*******1234`: the TCKN typed is never shown in full again. */
const masked = (tckn: string) => {
  const digits = compact(tckn)
  return digits === "" ? "" : `${"*".repeat(Math.max(digits.length - 4, 0))}${digits.slice(-4)}`
}

function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-[13px] text-muted-foreground">{label}</dt>
          <dd className="min-w-0 [overflow-wrap:anywhere]">
            {value === "" || value === null ? "—" : value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * Step 6, everything at a glance before "Kur": one card a step, of one
 * height in a row, each with "Düzenle" back to its step (until the record
 * is made); the invoice fields left blank said, not refused; then what
 * "Kur" does and, once pressed, how far it got.
 */
export function ReviewStep({
  draft,
  plan,
  platformDomain,
  progress,
  onEdit,
}: {
  draft: ShopDraft
  plan: Plan | null
  platformDomain: string | null
  progress: SetupProgress | null
  /** Null once the record is made: nothing before it can change. */
  onEdit: ((step: WizardStep) => void) | null
}) {
  const { t } = useTranslation()
  const packs = useQuery(sectorPacksQuery())
  const { company } = draft
  const sole = company.kind === "sole_proprietor"
  const missing = missingCompanyFields(company)
  // "Örnek ürünlerle başla": said only for a pack that offers it
  const samples = sampleProductsOf(packs.data?.sector_packs, draft.sector_pack)
  const samplesRow: [string, ReactNode][] =
    samples > 0
      ? [
          [
            t("wizard.samples.title"),
            draft.sample_catalog
              ? t("wizard.samples.yes", { count: samples })
              : t("wizard.samples.no"),
          ],
        ]
      : []
  const card = (step: WizardStep, children: ReactNode) => (
    <SectionCard
      title={t(`wizard.steps.${step}.title`)}
      className="h-full"
      action={
        onEdit ? (
          <Button
            size="icon"
            variant="ghost"
            aria-label={t("wizard.review.editStep", { step: t(`wizard.steps.${step}.title`) })}
            title={t("wizard.review.edit")}
            onClick={() => {
              onEdit(step)
            }}
          >
            <Pencil aria-hidden="true" />
          </Button>
        ) : undefined
      }
    >
      {children}
    </SectionCard>
  )
  const people = (["owner", "billing", "technical"] as const).filter(
    (who) => who === "owner" || draft[who].enabled
  )
  return (
    <>
      {missing.length > 0 ? (
        <Alert>
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>{t("wizard.review.missingTitle")}</AlertTitle>
          <AlertDescription>
            {t("wizard.review.missing", {
              fields: missing.map((field) => t(COMPANY_LABELS[field] ?? field)).join(", "),
            })}
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="grid items-stretch gap-[var(--grid-gap)] lg:grid-cols-2">
        {card(
          "company",
          <Facts
            rows={[
              [t("tenants.create.name"), draft.name.trim()],
              [t("company.kind"), t(`company.kinds.${company.kind}`)],
              [t("company.legalName"), company.legal_name.trim()],
              [t("company.taxOffice"), company.tax_office.trim()],
              sole
                ? [t("company.tckn"), masked(company.tckn)]
                : [t("company.taxNumber"), compact(company.tax_number)],
              [
                t("company.address"),
                [company.address_line, company.district, company.city, company.postal_code]
                  .map((part) => part.trim())
                  .filter(Boolean)
                  .join(", "),
              ],
            ]}
          />
        )}
        {card(
          "contacts",
          <Facts
            rows={people.map((who) => [
              t(`contacts.roles.${who}`),
              <span key={who} className="flex flex-col">
                {[draft[who].name, draft[who].email, draft[who].phone]
                  .map((part) => part.trim())
                  .filter(Boolean)
                  .map((part) => (
                    <span key={part}>{part}</span>
                  ))}
              </span>,
            ])}
          />
        )}
        {card(
          "package",
          <Facts
            rows={[
              [t("wizard.review.package"), plan?.name ?? ""],
              [t("packages.price"), plan ? priceText(t, plan) : ""],
            ]}
          />
        )}
        {card(
          "address",
          <Facts
            rows={[
              [
                t("wizard.address.result"),
                platformDomain ? `${slugOf(draft)}.${platformDomain}` : slugOf(draft),
              ],
              [t("wizard.address.custom"), domainOf(draft)],
              [
                t("wizard.steps.sector.title"),
                packName(packs.data?.sector_packs, draft.sector_pack),
              ],
              [
                t("wizard.steps.look.title"),
                chosenPreset(packs.data?.sector_packs, draft.sector_pack, draft.preset)?.name ??
                  t("wizard.look.noneShort"),
              ],
              ...samplesRow,
            ]}
          />
        )}
      </div>
      <SectionCard
        title={t("wizard.review.installTitle")}
        description={t("wizard.review.installText")}
      >
        {progress ? (
          <SetupProgressList progress={progress} />
        ) : (
          <ol className="flex list-decimal flex-col gap-1 pl-5 text-[13px] leading-5 text-muted-foreground">
            <li>{t("wizard.review.plan.record")}</li>
            <li>{t("wizard.review.plan.details")}</li>
            <li>{t("wizard.review.plan.setup")}</li>
            <li>{t("wizard.review.plan.open")}</li>
          </ol>
        )}
      </SectionCard>
    </>
  )
}
