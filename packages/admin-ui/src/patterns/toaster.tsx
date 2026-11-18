import { XIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { ADMIN_UI_NS } from "../i18n"
import { Toaster as Sonner } from "sonner"

/*
 * Every control in the row is 24 px with -2 px top and bottom margins, so it
 * takes the 20 px of a text line and sits centred on the first one. Sonner
 * puts the close button first in the markup; `order-last` draws it at the end.
 */
const ROW_CONTROL =
  "-my-0.5 inline-flex h-6 shrink-0 items-center justify-center rounded-md outline-none transition-colors focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring"

/*
 * The outcome reads at a glance (docs/18 §7): each result type sits on its
 * status tint with a border and a 3 px leading stripe in the status colour,
 * and Sonner's filled icon takes the same colour. The words keep the normal
 * text colours, which the engine holds at AA on every tint. The surface,
 * border and shadow live in the per-type keys only: Sonner joins class
 * names without merging, so a shared `bg-popover` would fight the tint.
 */
const TOAST_CLASSES = {
  toast:
    "group flex w-full items-start gap-3 rounded-lg border p-4 text-sm text-popover-foreground",
  icon: "flex h-5 shrink-0 items-center [&>svg]:size-5 group-data-[type=success]:text-success group-data-[type=error]:text-destructive group-data-[type=warning]:text-warning group-data-[type=info]:text-info",
  content: "flex min-w-0 flex-1 flex-col gap-0.5",
  title: "font-medium",
  description: "text-muted-foreground",
  default: "border-border bg-popover shadow-[var(--shadow-overlay)]",
  loading: "border-border bg-popover shadow-[var(--shadow-overlay)]",
  success:
    "border-success/45 bg-success-soft shadow-[inset_3px_0_0_var(--success),var(--shadow-overlay)]",
  error:
    "border-destructive/45 bg-destructive-soft shadow-[inset_3px_0_0_var(--destructive),var(--shadow-overlay)]",
  warning:
    "border-warning/45 bg-warning-soft shadow-[inset_3px_0_0_var(--warning),var(--shadow-overlay)]",
  info: "border-info/45 bg-info-soft shadow-[inset_3px_0_0_var(--info),var(--shadow-overlay)]",
  actionButton: `${ROW_CONTROL} bg-secondary px-2 text-xs font-medium text-secondary-foreground hover:bg-secondary/80`,
  cancelButton: `${ROW_CONTROL} px-2 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground`,
  closeButton: `${ROW_CONTROL} order-last -me-1 w-6 text-muted-foreground hover:bg-accent hover:text-accent-foreground`,
}

/**
 * Result notifications (docs/18 §7): short, bottom right, painted with the
 * tokens and coloured by outcome. Each leaves after four seconds unless the
 * call sets its own duration.
 */
export function Toaster() {
  const { t } = useTranslation(ADMIN_UI_NS)
  return (
    <Sonner
      // The region's name for screen readers; Sonner's own is English
      containerAriaLabel={t("common.notifications")}
      position="bottom-right"
      duration={4000}
      closeButton
      icons={{ close: <XIcon className="size-4" /> }}
      toastOptions={{
        unstyled: true,
        closeButtonAriaLabel: t("common.close"),
        classNames: TOAST_CLASSES,
      }}
    />
  )
}
