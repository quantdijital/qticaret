import { Gift } from "lucide-react"
import type { CartLineView, GiftLineView, Translate } from "@qticaret/ui"
import { GiftFields } from "../components/GiftFields"
import { giftWords } from "../components/gift-words"

/**
 * A gift card line's recipient under the line (adr/0025 Ek 2026-11-03),
 * and the form that names or changes them: open by itself while nobody is
 * named (the payment waits for it). A plain form inside `<details>`: no
 * script needed; a refusal comes back to the cart in words.
 */
export function GiftRecipient({
  line,
  gift,
  save,
  t,
}: {
  line: CartLineView
  gift: GiftLineView
  save: (form: FormData) => Promise<void>
  t: Translate
}) {
  const recipient = gift.recipient
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-muted/50 p-3 text-sm">
      <p className="flex items-start gap-2">
        <Gift className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {recipient ? (
          <span>
            {t("gift.to", {
              recipient: recipient.name
                ? `${recipient.name} (${recipient.email})`
                : recipient.email,
            })}
          </span>
        ) : (
          <span className="font-medium text-sale">{t("gift.recipient_missing")}</span>
        )}
      </p>
      <details open={!recipient} className="group">
        <summary className="cursor-pointer font-medium underline-offset-4 hover:underline">
          {recipient ? t("gift.edit") : t("gift.add_recipient")}
        </summary>
        <form action={save} className="mt-3 flex flex-col gap-3">
          <input type="hidden" name="line_id" value={line.id} />
          <GiftFields id={`hediye-${line.id}`} words={giftWords(t)} values={recipient} />
          <button
            type="submit"
            className="h-10 self-start rounded-button border border-foreground px-4 font-semibold"
          >
            {t("gift.save")}
          </button>
        </form>
      </details>
    </div>
  )
}
