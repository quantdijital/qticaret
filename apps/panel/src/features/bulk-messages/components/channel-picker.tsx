import { Mail, Smartphone } from "lucide-react"
import { useTranslation } from "react-i18next"
import { RadioGroup, RadioGroupItem } from "@qticaret/admin-ui/ui/radio-group"
import { BULK_CHANNELS } from "@/features/bulk-messages/api/types"
import type { BulkChannel } from "@/features/bulk-messages/api/types"

const ICONS = { email: Mail, sms: Smartphone } as const

/** E-posta or SMS: each campaign goes on one channel (adr/0050 §1). */
export function ChannelPicker({
  value,
  onChange,
  labelledBy,
  disabled = false,
}: {
  value: BulkChannel
  onChange: (channel: BulkChannel) => void
  labelledBy: string
  disabled?: boolean
}) {
  const { t } = useTranslation()
  return (
    <RadioGroup
      value={value}
      disabled={disabled}
      aria-labelledby={labelledBy}
      onValueChange={(next) => {
        onChange(next as BulkChannel)
      }}
      className="grid grid-cols-2 gap-2"
    >
      {BULK_CHANNELS.map((channel) => {
        const Icon = ICONS[channel]
        return (
          <label
            key={channel}
            className="flex h-9 cursor-pointer items-center gap-2.5 rounded-md border px-3 text-sm has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent"
          >
            <RadioGroupItem value={channel} />
            <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
            {t(`bulkMessages.channels.${channel}`)}
          </label>
        )
      })}
    </RadioGroup>
  )
}
