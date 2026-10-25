import { Toaster as Sonner } from "sonner"

/**
 * Result notifications (docs/18 §7): short, bottom right, painted with the
 * tokens. An error stays until closed; success leaves after four seconds.
 */
export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      duration={4000}
      closeButton
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "group flex w-full items-start gap-3 rounded-lg border bg-popover p-4 text-sm text-popover-foreground shadow-[var(--shadow-overlay)]",
          title: "font-medium",
          description: "text-muted-foreground",
          error: "border-destructive/40",
          success: "border-success/40",
          closeButton: "text-muted-foreground",
        },
      }}
    />
  )
}
