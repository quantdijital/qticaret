import { Eye, EyeOff } from "lucide-react"
import { useState } from "react"
import type { ComponentProps } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Input } from "@qticaret/admin-ui/ui/input"
import { cn } from "@qticaret/admin-ui/lib/utils"

/**
 * A password field with a button that shows what was typed (the shop
 * panel's): inside the field, after it in the tab order, named for what it
 * does next.
 */
export function PasswordInput({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  const { t } = useTranslation()
  const [shown, setShown] = useState(false)
  return (
    <div className="relative">
      <Input {...props} type={shown ? "text" : "password"} className={cn("pr-10", className)} />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="absolute top-1/2 right-0.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        aria-label={t(shown ? "auth.hidePassword" : "auth.showPassword")}
        aria-controls={props.id}
        onClick={() => {
          setShown(!shown)
        }}
      >
        {shown ? <EyeOff /> : <Eye />}
      </Button>
    </div>
  )
}
