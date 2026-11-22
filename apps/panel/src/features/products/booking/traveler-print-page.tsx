import "@/features/orders/print/print.css"
import { useQuery } from "@tanstack/react-query"
import { getRouteApi } from "@tanstack/react-router"
import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { slotBookingsQuery } from "@/features/products/api/booking"
import { errorText } from "@/lib/errors"
import { SLOT_ID } from "./traveler-print-link"
import { birthDateText, countryText, printedTravelers, whenOf } from "./traveler-text"

const T = "products.booking.travelers"
const route = getRouteApi("/_fullscreen/print/departure")

/**
 * `/print/departure?slot=&zone=&at=`: a departure's traveler list on A4
 * (adr/0076 §9), light whatever the panel's theme; it prints itself once
 * drawn. The number masked: the full one is read one at a time, recorded.
 * Reading it is the same recorded read as the panel's list.
 */
export function TravelerPrintPage() {
  const { t, i18n } = useTranslation()
  const search = route.useSearch()
  const slotId = search.slot && SLOT_ID.test(search.slot) ? search.slot : null
  const bookings = useQuery({ ...slotBookingsQuery(slotId ?? ""), enabled: slotId !== null })
  const printed = useRef(false)
  const title = t(`${T}.printTitle`)
  const when = whenOf(search.at, search.zone, i18n.language)

  useEffect(() => {
    document.title = title
  }, [title])
  useEffect(() => {
    if (!bookings.data || printed.current) {
      return
    }
    printed.current = true
    const timer = window.setTimeout(() => {
      window.print()
    }, 400)
    return () => {
      window.clearTimeout(timer)
    }
  }, [bookings.data])

  const rows = printedTravelers(bookings.data ?? [])
  return (
    <div className="print-doc">
      <div className="print-toolbar" role="toolbar" aria-label={title}>
        <strong>{title}</strong>
        <span>{when}</span>
        <span className="spacer" />
        <button
          type="button"
          onClick={() => {
            window.close()
          }}
        >
          {t("orders.print.close")}
        </button>
        <button
          type="button"
          className="primary"
          disabled={!bookings.data}
          onClick={() => {
            window.print()
          }}
        >
          {t("orders.print.print")}
        </button>
      </div>
      {slotId === null ? (
        <p className="print-message">{t(`${T}.noDeparture`)}</p>
      ) : bookings.isError ? (
        <p className="print-message" role="alert">
          {errorText(t, bookings.error)}
        </p>
      ) : !bookings.data ? (
        <p className="print-message">{t("common.loading")}</p>
      ) : (
        <section className="print-sheet" aria-label={title}>
          <div className="print-title">
            <h1>{title}</h1>
            <p className="print-muted">
              {when} · {t(`${T}.count`, { count: rows.length })}
            </p>
          </div>
          <table className="print-table" style={{ marginTop: 14 }}>
            <thead>
              <tr>
                <th className="num">#</th>
                <th>{t(`${T}.name`)}</th>
                <th>{t(`${T}.birthDate`)}</th>
                <th>{t(`${T}.nationality`)}</th>
                <th>{t(`${T}.document`)}</th>
                <th>{t("products.booking.bookings.order")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.id}>
                  <td className="num">{index + 1}</td>
                  <td>
                    <strong>
                      {row.first_name} {row.last_name}
                    </strong>
                  </td>
                  <td>{birthDateText(row.birth_date, i18n.language) ?? "—"}</td>
                  <td>{countryText(row.nationality, i18n.language) ?? "—"}</td>
                  <td>{row.document_masked ?? "—"}</td>
                  <td>{row.display_id === null ? "—" : `#${String(row.display_id)}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? <p className="print-message">{t(`${T}.none`)}</p> : null}
        </section>
      )}
    </div>
  )
}
