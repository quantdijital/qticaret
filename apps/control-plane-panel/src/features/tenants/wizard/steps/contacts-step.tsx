import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Checkbox } from "@qticaret/admin-ui/ui/checkbox"
import { Label } from "@qticaret/admin-ui/ui/label"
import type { PersonDraft, ShopDraft } from "../draft"
import { TextField } from "../field"
import type { StepProps } from "../field"

type Who = "owner" | "billing" | "technical"

/** Name, e-mail and phone side by side, one size each. */
function PersonFields({
  who,
  person,
  problems,
  onChange,
}: {
  who: Who
  person: PersonDraft
  problems: Record<string, string>
  onChange: (key: keyof PersonDraft, value: string) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <TextField
        id={`wizard-${who}-name`}
        label={t("contacts.columns.name")}
        value={person.name}
        maxLength={100}
        onChange={(value) => {
          onChange("name", value)
        }}
        problem={problems[`${who}.name`]}
      />
      <TextField
        id={`wizard-${who}-email`}
        label={t("contacts.columns.email")}
        type="email"
        inputMode="email"
        value={person.email}
        maxLength={254}
        onChange={(value) => {
          onChange("email", value)
        }}
        problem={problems[`${who}.email`]}
      />
      <TextField
        id={`wizard-${who}-phone`}
        label={t("contacts.columns.phone")}
        type="tel"
        inputMode="tel"
        value={person.phone}
        maxLength={40}
        onChange={(value) => {
          onChange("phone", value)
        }}
        problem={problems[`${who}.phone`]}
      />
    </div>
  )
}

/**
 * Step 2, the shop's contacts (C7): the owner is required, and their
 * e-mail is where the shop panel's owner invitation goes at the end of the
 * setup (the step says so). A billing and a technical contact are added
 * when asked for; a separate billing contact takes the payment reminders,
 * otherwise the owner has them.
 */
export function ContactsStep({ draft, change, problems }: StepProps) {
  const { t } = useTranslation()
  const set = (who: Who) => (key: keyof PersonDraft, value: string) => {
    change((current) => ({ ...current, [who]: { ...current[who], [key]: value } }))
  }
  const extra = (who: "billing" | "technical") => {
    const person: ShopDraft[typeof who] = draft[who]
    return (
      <SectionCard
        title={t(`wizard.contacts.${who}Title`)}
        description={t(`wizard.contacts.${who}Text`)}
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id={`wizard-${who}-enabled`}
              checked={person.enabled}
              onCheckedChange={(checked) => {
                change((current) => ({
                  ...current,
                  [who]: { ...current[who], enabled: checked === true },
                }))
              }}
            />
            <Label htmlFor={`wizard-${who}-enabled`} className="font-normal">
              {t(`wizard.contacts.${who}Add`)}
            </Label>
          </div>
          {person.enabled ? (
            <PersonFields who={who} person={person} problems={problems} onChange={set(who)} />
          ) : null}
        </div>
      </SectionCard>
    )
  }
  return (
    <>
      <SectionCard
        title={t("wizard.contacts.ownerTitle")}
        description={t("wizard.contacts.ownerText")}
      >
        <div className="flex flex-col gap-4">
          <PersonFields
            who="owner"
            person={draft.owner}
            problems={problems}
            onChange={set("owner")}
          />
          {/* Review L2: these go into the shop's settings, shown on its storefront */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Checkbox
                id="wizard-storefront-contact"
                checked={draft.storefront_contact}
                onCheckedChange={(checked) => {
                  change((current) => ({ ...current, storefront_contact: checked === true }))
                }}
              />
              <Label htmlFor="wizard-storefront-contact" className="font-normal">
                {t("wizard.contacts.storefrontUse")}
              </Label>
            </div>
            <p className="text-[13px] leading-5 text-muted-foreground">
              {t("wizard.contacts.storefrontNote")}
            </p>
          </div>
        </div>
      </SectionCard>
      {extra("billing")}
      {extra("technical")}
    </>
  )
}
