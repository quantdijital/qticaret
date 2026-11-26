import { Link } from "@tanstack/react-router"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { CardForm } from "@qticaret/admin-ui/patterns/card-form"
import { RadioGroup, RadioGroupItem } from "@qticaret/admin-ui/ui/radio-group"
import { SHIPPING_MANAGERS, useSaveSection } from "@/features/settings/api/sections"
import type { ShippingManager, ShippingSettings } from "@/features/settings/api/sections"
import { errorText } from "@/lib/errors"

const M = "settings.shipping.manager"

/**
 * Settings > Shipping: "Kargoyu nereden yönetiyorsun?" (the owner,
 * 2026-11-26; adr/0072 Ek 2026-11-26). The shop's own contracts (Aras,
 * Yurtiçi), or BirFatura's cargo module: labels made in BirFatura, the
 * tracking written back to the order. BirFatura is offered once it is the
 * connected invoicing program; until then the answer says why and where.
 */
export function ShippingManagerCard({
  saved,
  connected,
}: {
  saved: ShippingManager
  /** BirFatura is the invoicing program and its connection password is made. */
  connected: boolean
}) {
  const { t } = useTranslation()
  const save = useSaveSection<ShippingSettings>("shipping")
  const [choice, setChoice] = useState<ShippingManager>(saved)
  const [base, setBase] = useState(saved)
  // A save elsewhere (the invoicing program left BirFatura) moves what is stored
  if (base !== saved) {
    setBase(saved)
    setChoice(saved)
  }
  const blocked = (each: ShippingManager) => each === "birfatura" && !connected && saved !== each
  return (
    <CardForm
      title={t(`${M}.title`)}
      description={t(`${M}.description`)}
      dirty={choice !== saved}
      saving={save.isPending}
      onReset={() => {
        setChoice(saved)
      }}
      onSubmit={() => {
        save.mutate(
          { manager: choice },
          {
            onSuccess: () => toast.success(t("settings.saved")),
            onError: (failure) => toast.error(errorText(t, failure)),
          }
        )
      }}
    >
      <RadioGroup
        aria-label={t(`${M}.title`)}
        value={choice}
        onValueChange={(next) => {
          setChoice(next as ShippingManager)
        }}
        className="flex flex-col gap-2"
      >
        {SHIPPING_MANAGERS.map((each) => (
          <div
            key={each}
            className="flex flex-col gap-2 rounded-md border px-3 py-2.5 has-[[data-state=checked]]:border-primary"
          >
            <label
              className={`flex items-center gap-2.5 text-sm ${blocked(each) ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
            >
              <RadioGroupItem value={each} disabled={blocked(each)} />
              <span className="flex flex-col">
                <span className="font-medium">{t(`${M}.options.${each}`)}</span>
                <span className="text-[13px] text-muted-foreground">{t(`${M}.hints.${each}`)}</span>
              </span>
            </label>
            {blocked(each) ? (
              <p className="pl-7 text-[13px] text-warning-text" data-testid="shipping-manager-why">
                {t(`${M}.notConnected`)}{" "}
                <Link to="/settings/einvoice" className="font-medium text-foreground underline">
                  {t(`${M}.einvoiceLink`)}
                </Link>
              </p>
            ) : null}
          </div>
        ))}
      </RadioGroup>
      {choice === "birfatura" ? (
        <ul className="flex list-disc flex-col gap-1 pl-5 text-[13px] text-muted-foreground">
          <li>{t(`${M}.birfatura.labels`)}</li>
          <li>{t(`${M}.birfatura.tracking`)}</li>
          <li>{t(`${M}.birfatura.invoice`)}</li>
          <li>{t(`${M}.birfatura.price`)}</li>
        </ul>
      ) : null}
    </CardForm>
  )
}
