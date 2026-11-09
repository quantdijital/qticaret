import type { OrderGiftView, Translate } from "@qticaret/ui"

/**
 * A gift card line on the order (adr/0025 Ek 2026-11-03): each card's last
 * four and where it went ("•••• 1234 → ayse@…"), and that the recipient
 * was e-mailed (green); before the payment is in, that it will be.
 */
export function OrderGift({ gift, t }: { gift: OrderGiftView; t: Translate }) {
  const recipient = gift.recipient ?? t("gift.order_recipient_self")
  return (
    <span className="mt-1 flex flex-col gap-0.5 text-xs">
      {gift.cards.length > 0 ? (
        <>
          {gift.cards.map((last4, index) => (
            <span key={`${String(index)}:${last4}`} className="tabular text-text-2">
              {t("gift.order_card", { last4, recipient })}
            </span>
          ))}
          <span className="font-semibold text-ok">{t("gift.order_sent")}</span>
        </>
      ) : (
        <span className="text-text-2">{t("gift.order_pending", { recipient })}</span>
      )}
    </span>
  )
}
