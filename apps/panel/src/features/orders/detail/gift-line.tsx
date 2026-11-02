import { Link } from "@tanstack/react-router"
import { Fragment } from "react"
import { useTranslation } from "react-i18next"
import { giftLineOf } from "@/features/orders/gift-lines"

const G = "orders.detail.gift"

/**
 * Under a gift card line: the cards it issued (last four characters, each
 * opening the card on the gift cards page) and who they went to; before
 * payment, the recipient they will go to.
 */
export function GiftLineDetails({ metadata }: { metadata: unknown }) {
  const { t } = useTranslation()
  const gift = giftLineOf(metadata)
  if (!gift) {
    return null
  }
  const { recipient, cards } = gift
  return (
    <div className="mt-1 flex min-w-0 flex-col gap-0.5 text-xs text-muted-foreground">
      {cards.length > 0 ? (
        <span>
          {t(`${G}.cards`)}{" "}
          {cards.map((card, index) => (
            <Fragment key={card.id}>
              {index > 0 ? ", " : null}
              <Link
                to="/promotions/gift-cards"
                search={{ card: card.id }}
                className="font-mono whitespace-nowrap text-foreground hover:underline"
                aria-label={t(`${G}.open`, { last4: card.last4 })}
              >
                •••• {card.last4}
              </Link>
            </Fragment>
          ))}
        </span>
      ) : null}
      {recipient ? (
        <span className="truncate">
          {recipient.name
            ? t(`${G}.recipientNamed`, { name: recipient.name, email: recipient.email })
            : t(`${G}.recipient`, { email: recipient.email })}
        </span>
      ) : null}
      {recipient && cards.length === 0 ? <span>{t(`${G}.pending`)}</span> : null}
    </div>
  )
}
