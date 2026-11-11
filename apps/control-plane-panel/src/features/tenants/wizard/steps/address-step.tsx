import { CircleCheck, LoaderCircle } from "lucide-react"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { slugOf, stepProblems } from "../draft"
import type { AddressChecks } from "../draft"
import { TextField } from "../field"
import type { StepProps } from "../field"

const CHECKING = "wizard.address.checking"

/** A field's state as it is typed: checking, free, or its problem (a text key). */
function Status({ problem, free, id }: { problem: string | undefined; free: string; id: string }) {
  const { t } = useTranslation()
  if (problem === CHECKING) {
    return (
      <span id={id} className="flex items-center gap-1.5 text-muted-foreground">
        <LoaderCircle
          aria-hidden="true"
          className="size-3.5 animate-spin motion-reduce:animate-none"
        />
        {t(CHECKING)}
      </span>
    )
  }
  if (problem) {
    return null
  }
  return (
    <span id={id} className="flex items-center gap-1.5 text-success-text">
      <CircleCheck aria-hidden="true" className="size-3.5" />
      {free}
    </span>
  )
}

/**
 * Step 4, the shop's address: its slug, suggested from the name until
 * typed and fixed once made (its database and subdomain are named after
 * it), checked as it is typed (format, reserved, taken); the address it
 * makes under the platform's domain; optionally the shop's own domain,
 * recorded as waiting for its DNS check.
 */
export function AddressStep({
  draft,
  change,
  problems,
  checks,
  platformDomain,
}: StepProps & { checks: AddressChecks; platformDomain: string | null }) {
  const { t } = useTranslation()
  const slug = slugOf(draft)
  // Live: what is wrong is said while typing; a blank slug only once Next was tried
  const live = stepProblems("address", draft, checks)
  const slugProblem = slug === "" ? problems["slug"] : live["slug"]
  const domainTyped = draft.custom_domain.trim() !== ""
  const shown = (problem: string | undefined) => (problem === CHECKING ? undefined : problem)
  return (
    <>
      <SectionCard title={t("wizard.address.title")} description={t("wizard.address.text")}>
        <div className="flex flex-col gap-4">
          <TextField
            id="wizard-slug"
            label={t("tenants.create.slug")}
            value={slug}
            maxLength={30}
            onChange={(value) => {
              change((current) => ({ ...current, typed_slug: value.toLowerCase() }))
            }}
            problem={shown(slugProblem)}
            help={t("tenants.create.slugHelp")}
            suffix={
              platformDomain ? (
                <span className="shrink-0 text-sm text-muted-foreground">.{platformDomain}</span>
              ) : null
            }
          />
          <div className="flex flex-col gap-1 rounded-md bg-muted/60 px-3 py-2.5 text-[13px] leading-5">
            <span className="text-muted-foreground">{t("wizard.address.result")}</span>
            <span className="font-medium break-all">
              {slug && platformDomain ? `${slug}.${platformDomain}` : "—"}
            </span>
            {slug !== "" ? (
              <Status
                problem={slugProblem}
                free={t("wizard.address.free")}
                id="wizard-slug-status"
              />
            ) : null}
          </div>
        </div>
      </SectionCard>
      <SectionCard
        title={t("wizard.address.customTitle")}
        description={t("wizard.address.customText")}
      >
        <div className="flex flex-col gap-2">
          <TextField
            id="wizard-domain"
            label={t("wizard.address.custom")}
            value={draft.custom_domain}
            maxLength={253}
            onChange={(value) => {
              change((current) => ({ ...current, custom_domain: value }))
            }}
            problem={shown(live["custom_domain"])}
            help={t("wizard.address.customHelp")}
          />
          {domainTyped ? (
            <div className="text-[13px] leading-5">
              <Status
                problem={live["custom_domain"]}
                free={t("wizard.address.domainFree")}
                id="wizard-domain-status"
              />
            </div>
          ) : null}
        </div>
      </SectionCard>
    </>
  )
}
