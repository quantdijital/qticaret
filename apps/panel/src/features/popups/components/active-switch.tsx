import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import { useSetPopupActive } from "@/features/popups/api/popups"
import type { Popup } from "@/features/popups/api/types"
import { errorText } from "@/lib/errors"

const P = "popups"

/** On or off from the list; the row's click does not open the pop-up for it. */
export function ActiveSwitch({ popup, disabled }: { popup: Popup; disabled: boolean }) {
  const { t } = useTranslation()
  const set = useSetPopupActive()
  return (
    <Switch
      checked={popup.is_active}
      disabled={disabled || set.isPending}
      aria-label={t(`${P}.switchLabel`, { name: popup.name })}
      onClick={(event) => {
        event.stopPropagation()
      }}
      onCheckedChange={(next) => {
        set.mutate(
          { id: popup.id, is_active: next },
          {
            onSuccess: () => toast.success(t(next ? `${P}.turnedOn` : `${P}.turnedOff`)),
            onError: (failure) => toast.error(errorText(t, failure)),
          }
        )
      }}
    />
  )
}
