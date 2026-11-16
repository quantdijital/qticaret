import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ToggleGroup, ToggleGroupItem } from "@qticaret/admin-ui/ui/toggle-group"
import { CustomerDialog } from "@/features/customers/components/customer-dialog"
import { useWholesaleOpen } from "@/features/wholesale/api/access"
import { NewWholesalerDialog } from "./new-wholesaler-dialog"

export type CustomerKindChoice = "individual" | "wholesale"

const KIND_ID = "new-customer-kind"

function KindChoice({
  kind,
  onChange,
}: {
  kind: CustomerKindChoice
  onChange: (kind: CustomerKindChoice) => void
}) {
  const { t } = useTranslation()
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      value={kind}
      aria-label={t("wholesale.kind.label")}
      onValueChange={(next) => {
        if (next) {
          onChange(next as CustomerKindChoice)
        }
      }}
      className="w-full"
    >
      <ToggleGroupItem id={`${KIND_ID}-individual`} value="individual" className="flex-1">
        {t("wholesale.kind.individual")}
      </ToggleGroupItem>
      <ToggleGroupItem id={`${KIND_ID}-wholesale`} value="wholesale" className="flex-1">
        {t("wholesale.kind.wholesale")}
      </ToggleGroupItem>
    </ToggleGroup>
  )
}

/**
 * Müşteriler > "Yeni müşteri" (ADR-0068 §3): Bireysel (a guest, as
 * before) or Toptancı, chosen at the top of the window. The choice is
 * offered only where the shop sells wholesale and the person may manage
 * it; otherwise it is the customer window as it was.
 */
export function NewCustomerDialog({
  open,
  onOpenChange,
  initialKind = "individual",
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialKind?: CustomerKindChoice
}) {
  const wholesale = useWholesaleOpen()
  const [kind, setKind] = useState<CustomerKindChoice>(initialKind)
  // Switching keeps the caret on the choice; opening, the first field takes it
  const [switched, setSwitched] = useState(false)
  const close = (next: boolean) => {
    if (!next) {
      setKind(initialKind)
      setSwitched(false)
    }
    onOpenChange(next)
  }
  if (!wholesale) {
    return <CustomerDialog customer={null} open={open} onOpenChange={onOpenChange} />
  }
  const lead = (
    <KindChoice
      kind={kind}
      onChange={(next) => {
        setKind(next)
        setSwitched(true)
      }}
    />
  )
  const focus = switched ? `${KIND_ID}-${kind}` : null
  return kind === "wholesale" ? (
    <NewWholesalerDialog open={open} onOpenChange={close} lead={lead} initialFocus={focus} />
  ) : (
    <CustomerDialog
      customer={null}
      open={open}
      onOpenChange={close}
      lead={lead}
      initialFocus={focus}
    />
  )
}
