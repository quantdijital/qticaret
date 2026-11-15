import type { ComponentProps, ReactNode } from "react"
import { Button } from "@qticaret/admin-ui/ui/button"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { Hint } from "./shared/hint"

type BarButtonProps = Omit<ComponentProps<typeof Button>, "children" | "size"> & {
  icon: ReactNode
  label: string
  /** The label shows beside the icon on a wide screen only; the name is always there. */
  wideOnly?: boolean
}

/**
 * A top bar button, as tall as every other control there: its icon, and its
 * words where there is room for them (the name is read out either way).
 */
export function BarButton({ icon, label, wideOnly = true, className, ...props }: BarButtonProps) {
  return (
    <Hint label={label} side="bottom">
      <Button
        type="button"
        size="sm"
        aria-label={label}
        className={cn(wideOnly && "max-xl:w-8 max-xl:px-0", className)}
        {...props}
      >
        {icon}
        <span className={cn(wideOnly && "max-xl:hidden")}>{label}</span>
      </Button>
    </Hint>
  )
}
