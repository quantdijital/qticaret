"use client"

import { Eye, EyeOff } from "lucide-react"
import { useState } from "react"
import type { ComponentProps } from "react"
import { cn } from "@qticaret/ui/lib/utils"
import { FieldError } from "../checkout/fields"

/**
 * A password in the theme's 48 px pill, with a 44 px eye inside it that
 * shows the typed password and hides it again (a phone's keyboard makes
 * typos easy to miss). The label above, the hint and the refusal under it,
 * as every field of the theme.
 */
export function PasswordField({
  id,
  label,
  hint,
  error = null,
  show,
  hide,
  className,
  ...props
}: Omit<ComponentProps<"input">, "type"> & {
  id: string
  label: string
  hint?: string | undefined
  error?: string | null
  /** The eye's names: "Şifreyi göster", "Şifreyi gizle". */
  show: string
  hide: string
}) {
  const [visible, setVisible] = useState(false)
  const describedBy = [`${id}-hata`, hint ? `${id}-ipucu` : null].filter(Boolean).join(" ")
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="gf-field pr-14"
          {...props}
        />
        <button
          type="button"
          aria-controls={id}
          aria-label={visible ? hide : show}
          onClick={() => {
            setVisible((now) => !now)
          }}
          className="gf-icon-btn absolute top-1/2 right-1 -translate-y-1/2 text-text-2"
        >
          {visible ? (
            <EyeOff className="size-5" aria-hidden="true" strokeWidth={1.75} />
          ) : (
            <Eye className="size-5" aria-hidden="true" strokeWidth={1.75} />
          )}
        </button>
      </div>
      {hint && (
        <p id={`${id}-ipucu`} className="text-xs text-text-3">
          {hint}
        </p>
      )}
      <FieldError id={`${id}-hata`} message={error} />
    </div>
  )
}
