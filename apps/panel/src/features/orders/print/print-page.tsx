import "./print.css"
import { useQuery } from "@tanstack/react-query"
import { getRouteApi } from "@tanstack/react-router"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { packingSlipsQuery } from "@/features/orders/api/packing"
import { idsOf } from "@/features/orders/print/open-print"
import { PackingSlip } from "@/features/orders/print/packing-slip"
import { PickListSheet } from "@/features/orders/print/pick-list-sheet"
import { errorText } from "@/lib/errors"

const P = "orders.print"
const route = getRouteApi("/_fullscreen/print/orders")

/**
 * `/print/orders?kind=slip|pick&ids=`: the picked orders' packing slips, a
 * page each, or their pick list, on A4 and light whatever the panel's
 * theme; it prints itself once drawn, and a bar above (not printed) prints
 * again, adds the team's notes to the slips, or closes the tab.
 */
export function PrintOrdersPage() {
  const { t } = useTranslation()
  const search = route.useSearch()
  const ids = idsOf(search.ids)
  const kind = search.kind ?? "slip"
  const slips = useQuery({ ...packingSlipsQuery(ids), enabled: ids.length > 0 })
  const [notes, setNotes] = useState(false)
  const printed = useRef(false)

  useEffect(() => {
    if (!slips.data || printed.current) {
      return
    }
    printed.current = true
    // The logo and the fonts first: a frame later the page is drawn
    const timer = window.setTimeout(() => {
      window.print()
    }, 400)
    return () => {
      window.clearTimeout(timer)
    }
  }, [slips.data])

  const title = kind === "pick" ? t(`${P}.pickTitle`) : t(`${P}.slipsTitle`)
  useEffect(() => {
    document.title = title
  }, [title])

  return (
    <div className="print-doc">
      <div className="print-toolbar" role="toolbar" aria-label={title}>
        <strong>{title}</strong>
        <span>{t(`${P}.ordersCount`, { count: slips.data?.orders.length ?? ids.length })}</span>
        <span className="spacer" />
        {kind === "slip" ? (
          <label>
            <input
              type="checkbox"
              checked={notes}
              onChange={(event) => {
                setNotes(event.target.checked)
              }}
            />
            {t(`${P}.withNotes`)}
          </label>
        ) : null}
        <button
          type="button"
          onClick={() => {
            window.close()
          }}
        >
          {t(`${P}.close`)}
        </button>
        <button
          type="button"
          className="primary"
          disabled={!slips.data}
          onClick={() => {
            window.print()
          }}
        >
          {t(`${P}.print`)}
        </button>
      </div>
      {ids.length === 0 ? (
        <p className="print-message">{t(`${P}.noOrders`)}</p>
      ) : slips.isError ? (
        <p className="print-message" role="alert">
          {errorText(t, slips.error)}
        </p>
      ) : !slips.data ? (
        <p className="print-message">{t("common.loading")}</p>
      ) : kind === "pick" ? (
        <PickListSheet slips={slips.data} />
      ) : (
        slips.data.orders.map((order) => (
          <PackingSlip
            key={order.id}
            order={order}
            shop={slips.data.shop}
            prices={slips.data.prices}
            notes={notes}
          />
        ))
      )}
    </div>
  )
}
