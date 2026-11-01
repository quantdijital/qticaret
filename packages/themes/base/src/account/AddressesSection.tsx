import type { AccountActions, AccountPageView, Translate } from "@qticaret/ui"
import { AddressForm } from "../checkout/AddressForm"

const ERRORS = [
  "checkout.address_invalid",
  "checkout.phone_invalid",
  "checkout.name_required",
  "checkout.location_required",
  "checkout.street_required",
]

/**
 * The account's address book (D8): the saved addresses, each to remove,
 * and a form for one more, the checkout's own (province, district and
 * neighbourhood from the country's lists), without the e-mail.
 */
export function AddressesSection({
  view,
  actions,
  t,
}: {
  view: AccountPageView
  actions: AccountActions
  t: Translate
}) {
  const { addAddress, districts, neighborhoods } = actions
  return (
    <section aria-labelledby="adresler" className="flex flex-col gap-4">
      <h2 id="adresler" className="text-2xl">
        {t("account.addresses")}
      </h2>
      {view.addresses.length === 0 ? (
        <p className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">
          {t("account.no_addresses")}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {view.addresses.map((address) => (
            <li
              key={address.id}
              className="flex flex-col gap-2 rounded-2xl border bg-card p-4 text-sm"
            >
              <address className="flex flex-col not-italic">
                <span className="font-medium">{address.name}</span>
                {address.lines.map((line) => (
                  <span key={line} className="text-muted-foreground">
                    {line}
                  </span>
                ))}
              </address>
              <form action={actions.removeAddress}>
                <input type="hidden" name="id" value={address.id} />
                <button type="submit" className="text-muted-foreground underline">
                  {t("cart.remove")}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
      {view.newAddress && addAddress && districts && neighborhoods && (
        <details className="rounded-2xl border bg-card p-5">
          <summary className="cursor-pointer font-semibold">{t("account.add_address")}</summary>
          <div className="mt-4">
            <AddressForm
              step={view.newAddress}
              actions={{ saveAddress: addAddress, districts, neighborhoods }}
              withEmail={false}
              words={{
                email: t("checkout.email"),
                emailHint: t("checkout.email_hint"),
                phone: t("checkout.phone"),
                phoneHint: t("checkout.phone_hint"),
                firstName: t("checkout.first_name"),
                lastName: t("checkout.last_name"),
                province: t("checkout.province"),
                district: t("checkout.district"),
                neighborhood: t("checkout.neighborhood"),
                choose: t("checkout.choose"),
                street: t("checkout.street"),
                streetHint: t("checkout.street_hint"),
                submit: t("account.save_address"),
                saving: t("checkout.saving"),
                errors: Object.fromEntries(ERRORS.map((key) => [key, t(key)])),
                fallback: t("checkout.address_invalid"),
              }}
            />
          </div>
        </details>
      )}
    </section>
  )
}
