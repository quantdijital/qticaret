import { ChevronDown, CircleAlert, Gift } from "lucide-react"
import type { CartLineView, GiftLineView, Translate } from "@qticaret/ui"
import { KeptForm } from "@qticaret/ui/components/kept-form"
import { GiftRecipientFields } from "../product/Extras"
import { giftWords } from "../product/words"

/**
 * A gift card line's recipient under the line (adr/0025 Ek 2026-11-03),
 * and the form that names or changes them: the product page's fields in
 * a closed row inside the line's well, open by itself while nobody is
 * named (the payment waits for it). A plain form: no script needed; a
 * refusal comes back to the cart in words, what was typed still in the
 * fields.
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
    <div className="flex flex-col gap-2 rounded-media gf-pane-inner p-3 text-sm sm:p-4">
      {recipient ? (
        <p className="flex items-start gap-2">
          <Gift className="mt-0.5 size-4 shrink-0" aria-hidden="true" strokeWidth={2} />
          <span>
            {t("gift.to", {
              recipient: recipient.name
                ? `${recipient.name} (${recipient.email})`
                : recipient.email,
            })}
          </span>
        </p>
      ) : (
        <p className="flex items-start gap-1.5 font-semibold text-error">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" strokeWidth={2} />
          {t("gift.recipient_missing")}
        </p>
      )}
      <details open={!recipient} className="group">
        <summary className="gf-link cursor-pointer">
          {recipient ? t("gift.edit") : t("gift.add_recipient")}
          <ChevronDown
            className="size-4 transition-transform duration-(--dur-micro) group-open:rotate-180"
            aria-hidden="true"
            strokeWidth={2}
          />
        </summary>
        <KeptForm action={save} className="mt-2 flex flex-col gap-3">
          <input type="hidden" name="line_id" value={line.id} />
          <GiftRecipientFields
            prefix={`hediye-${line.id}`}
            words={giftWords(t)}
            values={recipient}
          />
          <button type="submit" className="gf-btn gf-btn--quiet gf-btn--small self-start">
            {t("gift.save")}
          </button>
        </KeptForm>
      </details>
    </div>
  )
}
