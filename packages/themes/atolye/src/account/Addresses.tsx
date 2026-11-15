import { ChevronDown, MapPin, Plus, Trash2 } from "lucide-react"
import type { AccountActions, AccountPageView, Translate } from "@qticaret/ui"
import { AddressForm } from "../checkout/AddressForm"
import { placeholderWords } from "../parts/placeholders"

const ERRORS = [
  "checkout.address_invalid",
  "checkout.phone_invalid",
  "checkout.name_required",
  "checkout.location_required",
  "checkout.street_required",
  "errors.too_many_requests",
]

type Address = AccountPageView["addresses"][number]

/**
 * Taking an address off, asked once: "Sil" opens a small well in place
 * with the question and the button that does it (a plain form); the same
 * row then reads "Vazgeç" and closes it. No script needed.
 */
function RemoveAddress({
  address,
  t,
  remove,
}: {
  address: Address
  t: Translate
  remove: AccountActions["removeAddress"]
}) {
  return (
    <details className="group mt-auto">
      <summary className="gf-btn gf-btn--quiet gf-btn--small w-fit">
        <Trash2 className="size-4 group-open:hidden" aria-hidden="true" strokeWidth={2} />
        <span className="group-open:hidden">
          {t("account.address_remove")}
          <span className="sr-only">: {address.name}</span>
        </span>
        <span className="hidden group-open:inline">{t("account.cancel")}</span>
      </summary>
      <form
        action={remove}
        className="mt-3 flex flex-wrap items-center gap-3 rounded-media gf-pane-inner p-4"
      >
        <input type="hidden" name="id" value={address.id} />
        <p className="flex-1 text-sm font-semibold">{t("account.address_remove_confirm")}</p>
        <button
          type="submit"
          className="gf-btn gf-btn--quiet gf-btn--small border-error text-error"
        >
          {t("account.address_remove_yes")}
        </button>
      </form>
    </details>
  )
}

/**
 * The account's address book: each saved address a tinted card (the
 * name heavy, the lines, the phone), two across from 768 px, each with
 * its own asked-once removal; then "Yeni adres ekle", a row that opens in
 * place onto the checkout's own form (province, district and
 * neighbourhood from the country's lists, each filling the next), open
 * from the start when the book is empty. The newest fills the next checkout.
 */
export function Addresses({
  view,
  t,
  actions,
}: {
  view: AccountPageView
  t: Translate
  actions: AccountActions
}) {
  const { addAddress, districts, neighborhoods } = actions
  const empty = view.addresses.length === 0
  return (
    <>
      {empty ? (
        <p className="flex items-start gap-3 rounded-tile gf-pane p-6 text-md sm:p-8">
          <MapPin
            className="mt-0.5 size-5 shrink-0 text-text-2"
            aria-hidden="true"
            strokeWidth={1.75}
          />
          {t("account.no_addresses")}
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-[repeat(2,minmax(0,1fr))]">
          {view.addresses.map((address) => (
            <li key={address.id} className="flex flex-col gap-5 rounded-tile gf-pane p-5 sm:p-6">
              <address className="flex flex-col gap-0.5 text-md not-italic">
                <span className="font-extrabold">{address.name}</span>
                {address.lines.map((line) => (
                  <span key={line} className="text-text-2">
                    {line}
                  </span>
                ))}
              </address>
              <RemoveAddress address={address} t={t} remove={actions.removeAddress} />
            </li>
          ))}
        </ul>
      )}
      {view.newAddress && addAddress && districts && neighborhoods && (
        <details id="yeni-adres" open={empty} className="group rounded-tile gf-pane">
          <summary className="flex min-h-16 cursor-pointer items-center gap-3 px-5 text-md font-extrabold sm:px-6">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-text text-paper">
              <Plus className="size-4.5" aria-hidden="true" strokeWidth={2} />
            </span>
            {t("account.add_address")}
            <ChevronDown
              className="ml-auto size-5 shrink-0 text-text-2 transition-transform duration-(--dur-short) group-open:rotate-180"
              aria-hidden="true"
              strokeWidth={1.75}
            />
          </summary>
          <div className="max-w-[48rem] px-5 pt-2 pb-6 sm:px-6 sm:pb-8">
            <AddressForm
              step={view.newAddress}
              actions={{ saveAddress: addAddress, districts, neighborhoods }}
              withEmail={false}
              words={{
                contact: t("checkout.contact"),
                delivery: t("order.delivery"),
                email: t("checkout.email"),
                emailHint: t("checkout.email_hint"),
                phone: t("checkout.phone"),
                phoneHint: t("checkout.phone_hint"),
                firstName: t("checkout.first_name"),
                lastName: t("checkout.last_name"),
                province: t("checkout.province"),
                district: t("checkout.district"),
                neighborhood: t("checkout.neighborhood"),
                loading: t("checkout.loading"),
                street: t("checkout.street"),
                streetHint: t("checkout.street_hint"),
                submit: t("account.save_address"),
                saving: t("checkout.saving"),
                errors: Object.fromEntries(ERRORS.map((key) => [key, t(key)])),
                fallback: t("checkout.address_invalid"),
                placeholders: placeholderWords(t),
              }}
            />
          </div>
        </details>
      )}
    </>
  )
}
