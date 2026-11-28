import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { LeaveGuard } from "@qticaret/admin-ui/patterns/leave-guard"
import { PageColumn, PageGrid } from "@qticaret/admin-ui/patterns/page-grid"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { Wizard } from "@qticaret/admin-ui/patterns/wizard"
import { Alert, AlertDescription, AlertTitle } from "@qticaret/admin-ui/ui/alert"
import { plansQuery } from "@/features/packages/api"
import { TENANTS_KEY } from "@/features/tenants/api"
import { codeOf } from "@/lib/api"
import { errorText } from "@/lib/errors"
import { isStepUpCancelled } from "@/lib/step-up"
import { setupCalls } from "./calls"
import { WIZARD_STEPS, emptyDraft, firstStepWithProblems, isDirty, stepProblems } from "./draft"
import type { ShopDraft, WizardStep } from "./draft"
import { DraftSummary } from "./draft-summary"
import { WizardFooter } from "./footer"
import { failedParts, isComplete, plannedProgress, runSetup } from "./setup-sequence"
import type { SetupCalls, SetupProgress } from "./setup-sequence"
import { AddressStep } from "./steps/address-step"
import { CompanyStep } from "./steps/company-step"
import { ContactsStep } from "./steps/contacts-step"
import { PackageStep } from "./steps/package-step"
import { ReviewStep } from "./steps/review-step"
import { LookStep } from "./steps/look-step"
import { SectorStep } from "./steps/sector-step"
import { useAddressChecks } from "./use-address-checks"

// The control plane refused the address the record was to take: back to that step
const ADDRESS_CODES = ["cp.slug_taken", "cp.slug_invalid", "cp.slug_reserved", "cp.domain_taken"]
const REVIEW = WIZARD_STEPS.length - 1

/**
 * "Yeni mağaza" (C11, adr/0061 §8 F17.1; owner, operator): Firma →
 * Yetkililer → Paket → Adres → Sektör paketi → Görünüm → Özet ve kur, one question
 * group at a time (docs/18 §7 Wizard). Back and forth keeps what was
 * typed; Next checks the step first and says what is missing beside the
 * field; leaving with something typed asks. "Kur" makes the record, saves
 * the rest and starts the setup (setup-sequence.ts), then the shop's page
 * opens on its "Kurulum" tab.
 */
export function NewTenantPage({ calls = setupCalls }: { calls?: SetupCalls }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const client = useQueryClient()
  const [draft, setDraft] = useState<ShopDraft>(emptyDraft)
  const [current, setCurrent] = useState(0)
  const [reached, setReached] = useState(0)
  const [tried, setTried] = useState<ReadonlySet<WizardStep>>(new Set())
  const [progress, setProgress] = useState<SetupProgress | null>(null)
  const [running, setRunning] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const { checks, platformDomain } = useAddressChecks(draft)
  const plans = useQuery(plansQuery())
  const plan = plans.data?.plans.find((each) => each.id === draft.package_id) ?? null
  const step = WIZARD_STEPS[current] ?? "company"
  const made = progress?.tenantId ?? null
  const problems = tried.has(step) ? stepProblems(step, draft, checks) : {}

  const goTo = (index: number) => {
    setCurrent(index)
    setReached((was) => Math.max(was, index))
    window.scrollTo({ top: 0 })
  }
  const next = () => {
    setTried((was) => new Set(was).add(step))
    if (Object.keys(stepProblems(step, draft, checks)).length === 0) {
      goTo(current + 1)
    }
  }
  const openShop = (id: string) => {
    void navigate({
      to: "/tenants/$id",
      params: { id },
      search: { part: "setup" },
      ignoreBlocker: true,
    })
  }
  const install = async () => {
    setFailure(null)
    const wrong = firstStepWithProblems(draft, checks)
    if (!made && wrong >= 0 && wrong < REVIEW) {
      setTried(new Set(WIZARD_STEPS))
      goTo(wrong)
      return
    }
    setRunning(true)
    const start = progress?.tenantId ? progress : plannedProgress(draft)
    const end = await runSetup(draft, calls, start, setProgress)
    setRunning(false)
    if (end.tenantId) {
      void client.invalidateQueries({ queryKey: TENANTS_KEY })
    }
    if (end.tenantId && isComplete(end)) {
      toast.success(t("wizard.done"))
      openShop(end.tenantId)
      return
    }
    const refused = end.parts.record.state === "failed" ? end.parts.record.error : null
    if (refused !== null) {
      // Nothing was made: the wizard stays as it was
      setProgress(null)
      if (isStepUpCancelled(refused)) {
        return
      }
      if (ADDRESS_CODES.some((code) => codeOf(refused)?.includes(code))) {
        void client.invalidateQueries({ queryKey: ["tenants", "availability"] })
        setTried((was) => new Set(was).add("address"))
        goTo(WIZARD_STEPS.indexOf("address"))
      }
      setFailure(errorText(t, refused))
    }
  }

  const steps = WIZARD_STEPS.map((key) => ({
    key,
    title: t(`wizard.steps.${key}.title`),
    description: t(`wizard.steps.${key}.description`),
  }))
  const props = {
    draft,
    problems,
    change: (update: (was: ShopDraft) => ShopDraft) => {
      setDraft(update)
    },
  }
  const partial = made !== null && progress !== null && failedParts(progress).length > 0
  return (
    <div className="flex flex-col gap-6">
      <LeaveGuard when={isDirty(draft) && !(progress && isComplete(progress))} />
      <PageHeader
        title={t("wizard.title")}
        description={t("wizard.text")}
        back={{ to: "/tenants", label: t("nav.shops") }}
      />
      <form
        noValidate
        onSubmit={(event) => {
          // Enter moves on; "Kur" is always its own button
          event.preventDefault()
          if (current < REVIEW) {
            next()
          }
        }}
      >
        <Wizard
          steps={steps}
          current={current}
          // Once the record is made, nothing before the review can change
          reached={made ? REVIEW : reached}
          onStepSelect={made ? () => undefined : goTo}
          footer={
            <WizardFooter
              first={current === 0}
              last={current === REVIEW}
              made={made}
              partial={partial}
              running={running}
              onBack={() => {
                goTo(current - 1)
              }}
              onInstall={() => void install()}
              onOpenShop={openShop}
            />
          }
        >
          <PageGrid>
            <PageColumn span={8}>
              {failure ? (
                <p role="alert" className="text-sm text-destructive">
                  {failure}
                </p>
              ) : null}
              {partial ? (
                <Alert variant="destructive">
                  <AlertTitle>{t("wizard.partial.title")}</AlertTitle>
                  <AlertDescription>{t("wizard.partial.text")}</AlertDescription>
                </Alert>
              ) : null}
              {step === "company" ? <CompanyStep {...props} /> : null}
              {step === "contacts" ? <ContactsStep {...props} /> : null}
              {step === "package" ? <PackageStep {...props} /> : null}
              {step === "address" ? (
                <AddressStep {...props} checks={checks} platformDomain={platformDomain} />
              ) : null}
              {step === "sector" ? <SectorStep {...props} /> : null}
              {step === "look" ? <LookStep {...props} /> : null}
              {step === "review" ? (
                <ReviewStep
                  draft={draft}
                  plan={plan}
                  platformDomain={platformDomain}
                  progress={progress}
                  onEdit={
                    made
                      ? null
                      : (key) => {
                          goTo(WIZARD_STEPS.indexOf(key))
                        }
                  }
                />
              ) : null}
            </PageColumn>
            <PageColumn span={4} sticky>
              <DraftSummary draft={draft} plan={plan} platformDomain={platformDomain} />
            </PageColumn>
          </PageGrid>
        </Wizard>
      </form>
    </div>
  )
}
