import { Check, Copy } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

const S = "paymentLinks.share"

/**
 * A text staff paste elsewhere (the link, the message): copied with one
 * press, and selectable for a browser that refuses the clipboard.
 */
export function CopyField({
  id,
  label,
  value,
  multiline = false,
}: {
  id: string
  label: string
  value: string
  multiline?: boolean
}) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const select = (event: { currentTarget: HTMLInputElement | HTMLTextAreaElement }) => {
    event.currentTarget.select()
  }
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="flex items-start gap-2">
        {multiline ? (
          <Textarea
            id={id}
            readOnly
            value={value}
            rows={3}
            className="text-[13px] md:text-[13px]"
            onFocus={select}
          />
        ) : (
          <Input
            id={id}
            readOnly
            value={value}
            className="font-mono text-[13px] md:text-[13px]"
            onFocus={select}
          />
        )}
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={t(`${S}.copy`, { what: label })}
          onClick={() => {
            navigator.clipboard.writeText(value).then(
              () => {
                setCopied(true)
                toast.success(t(`${S}.copied`))
              },
              // Refused without the page's clipboard permission: the text stays selectable
              () => toast.error(t(`${S}.copyFailed`))
            )
          }}
        >
          {copied ? <Check /> : <Copy />}
        </Button>
      </div>
    </div>
  )
}
