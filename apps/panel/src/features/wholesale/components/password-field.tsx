import { Check, Copy, RefreshCw } from "lucide-react"
import { useState } from "react"
import type { ComponentProps } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Input } from "@qticaret/admin-ui/ui/input"
import { generatePassword } from "@/features/wholesale/password"

const P = "wholesale.password"

/**
 * The wholesaler's password as staff type or make it (ADR-0068 Ek
 * 2026-11-15 (2)): shown in this window only, to be handed over, with a
 * button that makes a strong one and one that copies it. Never shown
 * again: the server keeps only its hash.
 */
export function PasswordField({
  id,
  value,
  onChange,
  ...props
}: Omit<ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  id: string
  value: string
  onChange: (value: string) => void
}) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex gap-2">
      <Input
        id={id}
        type="text"
        autoComplete="new-password"
        spellCheck={false}
        className="font-mono"
        value={value}
        onChange={(event) => {
          setCopied(false)
          onChange(event.target.value)
        }}
        {...props}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={t(`${P}.generate`)}
        title={t(`${P}.generate`)}
        onClick={() => {
          setCopied(false)
          onChange(generatePassword())
        }}
      >
        <RefreshCw />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={t(`${P}.copy`)}
        title={t(`${P}.copy`)}
        disabled={value === ""}
        onClick={() => {
          // Refused without the page's clipboard permission: the field stays selectable
          navigator.clipboard.writeText(value).then(
            () => {
              setCopied(true)
            },
            () => toast.error(t(`${P}.copyFailed`))
          )
        }}
      >
        {copied ? <Check /> : <Copy />}
      </Button>
    </div>
  )
}
