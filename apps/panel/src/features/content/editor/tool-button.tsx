import type { LucideIcon } from "lucide-react"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@qticaret/admin-ui/ui/tooltip"
import { cn } from "@qticaret/admin-ui/lib/utils"

/** One toolbar action: an icon, its name on hover and to screen readers, pressed when on. */
export function ToolButton({
  icon: Icon,
  label,
  active = false,
  disabled = false,
  onClick,
}: {
  icon: LucideIcon
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("size-8", active && "bg-accent text-accent-foreground")}
          aria-label={label}
          aria-pressed={active}
          disabled={disabled}
          // Keep the selection in the text while the button is pressed
          onMouseDown={(event) => {
            event.preventDefault()
          }}
          onClick={onClick}
        >
          <Icon />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
