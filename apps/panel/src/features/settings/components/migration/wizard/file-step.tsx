import { useTranslation } from "react-i18next"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { Input } from "@qticaret/admin-ui/ui/input"
import { WXR_ACCEPT } from "@/features/settings/api/migration-wordpress"
import {
  AdvancedOptions,
  ParcelFields,
} from "@/features/settings/components/migration/run-controls"
import { ShopifyConnection } from "@/features/settings/components/migration/shopify-connection"
import type { WizardDraft } from "@/features/settings/components/migration/wizard/state"

const R = "settings.migration.run"
const W = "settings.migration.wordpress"
const ACCEPT = {
  wordpress: WXR_ACCEPT,
  customers: ".xlsx,.csv",
  bundle: ".json,application/json",
} as const

interface FileStepProps {
  draft: WizardDraft
  /** The problem the last "İncele" met, as an i18n key. */
  problem: string | null
  onChange: (draft: WizardDraft) => void
}

/**
 * Step 2: the one question the source asks (its export, its connection,
 * its feed's address), and the options most shops leave empty folded
 * under "Gelişmiş". The file stays on the page: the transfer sends it again.
 */
export function FileStep({ draft, problem, onChange }: FileStepProps) {
  const { t } = useTranslation()
  const set = (next: Partial<WizardDraft>) => {
    onChange({ ...draft, ...next })
  }
  const { source } = draft
  return (
    <div className="flex max-w-3xl flex-col gap-4 rounded-lg border bg-card px-5 py-5 shadow-card">
      {source === "shopify" ? <ShopifyConnection /> : null}
      {source === "feed" ? (
        <Field
          label={t(`${R}.feedUrl`)}
          htmlFor="wizard-feed"
          hint={t(`${R}.hints.feed`)}
          error={problem?.endsWith("urlRequired") ? t(problem) : undefined}
        >
          <Input
            id="wizard-feed"
            type="url"
            inputMode="url"
            placeholder="https://eski-magaza.com/xml/google.xml"
            value={draft.url}
            onChange={(event) => {
              set({ url: event.target.value })
            }}
          />
        </Field>
      ) : null}
      {source === "wordpress" || source === "customers" || source === "bundle" ? (
        <Field
          label={t(source === "wordpress" ? `${W}.file` : `${R}.file`)}
          htmlFor="wizard-file"
          hint={t(source === "wordpress" ? `${R}.hints.wordpress` : `${R}.hints.${source}`)}
          error={
            problem && (problem.includes(".errors.file") || problem.endsWith("fileRequired"))
              ? t(problem)
              : undefined
          }
        >
          <Input
            id="wizard-file"
            type="file"
            accept={ACCEPT[source]}
            onChange={(event) => {
              set({ file: event.target.files?.[0] ?? null })
            }}
          />
        </Field>
      ) : null}
      {draft.file ? (
        <p className="text-[13px] text-muted-foreground">
          {t("settings.migration.wizard.fileKept")}
        </p>
      ) : null}
      {source !== "customers" ? (
        <AdvancedOptions
          attention={
            problem !== null && (problem.endsWith("categoryBase") || problem.endsWith("parcel"))
          }
        >
          {source === "wordpress" ? (
            <Field
              label={t(`${W}.categoryBase`)}
              htmlFor="wizard-category-base"
              hint={t(`${W}.categoryBaseHint`)}
              error={problem?.endsWith("categoryBase") ? t(problem) : undefined}
            >
              <Input
                id="wizard-category-base"
                placeholder="/urun-kategori/"
                autoComplete="off"
                spellCheck={false}
                value={draft.categoryBase}
                onChange={(event) => {
                  set({ categoryBase: event.target.value })
                }}
              />
            </Field>
          ) : null}
          <ParcelFields
            {...(source === "wordpress" ? { note: t(`${W}.parcelNote`) } : {})}
            error={problem?.endsWith("parcel") ? t(problem) : undefined}
            inputProps={(field) => ({
              value: draft.parcel[field],
              onChange: (event) => {
                set({ parcel: { ...draft.parcel, [field]: event.target.value } })
              },
            })}
          />
        </AdvancedOptions>
      ) : null}
    </div>
  )
}
