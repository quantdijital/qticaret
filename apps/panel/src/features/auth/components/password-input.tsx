import { Eye, EyeOff } from "lucide-react"
import { useState } from "react"
import type { ComponentProps } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Input } from "@qticaret/admin-ui/ui/input"
import { cn } from "@qticaret/admin-ui/lib/utils"

/**
 * A password field with a button that shows what was typed. The button
 * sits inside the field, after it in the tab order, and is named for what
 * it does next ("Şifreyi göster" / "Şifreyi gizle").
 */
export function PasswordInput({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  const { t } = useTranslation()
  const [shown, setShown] = useState(false)
  return (
    <div className="relative">
      <Input
        // placeholder-exempt: a password has no example
        {...props}
        type={shown ? "text" : "password"}
        className={cn("pr-10", className)}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="absolute top-1/2 right-0.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        aria-label={t(shown ? "login.hidePassword" : "login.showPassword")}
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
