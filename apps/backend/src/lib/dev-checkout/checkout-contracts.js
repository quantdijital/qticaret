// The payment test page's contracts and age step (adr/0028, adr/0041 §2, §4): with checkout.js, one script.
/* global $, el, api, state */
/* exported loadContracts, acceptContracts, loadAgeCheck, declareAge */

const CONTRACT_KINDS = ["pre_information", "distance_sales"]
const PAYMENT_OF = {
  "pp_bank-transfer_bank-transfer": "bank_transfer",
  pp_cod_cod: "cash_on_delivery",
}

/** The contracts filled for the cart as it stands, and the box that accepts them. */
async function loadContracts() {
  if (!state.cart?.shipping_methods?.length) return
  const provider = document.querySelector("input[name=provider]:checked")?.value
  const payment = PAYMENT_OF[provider] ?? "card"
  const shown = await Promise.all(
    CONTRACT_KINDS.map((kind) =>
      api(`/store/carts/${state.cart.id}/legal/${kind}?payment=${payment}`).then(
        ({ document }) => document,
        // A text the shop has not published is not asked for
        () => null
      )
    )
  )
  state.contracts = shown.filter(Boolean)
  $("accept-row").hidden = state.contracts.length === 0
  $("contracts").replaceChildren(
    ...(state.contracts.length
      ? state.contracts.map((contract) => {
          // The server's own rendering of a checked document: text escaped, no script
          const body = el("div", { className: "contract" })
          body.innerHTML = contract.html
          return el(
            "details",
            {},
            el("summary", { textContent: `${contract.title} (sürüm ${contract.version})` }),
            body
          )
        })
      : ["Mağazanın yayında sözleşmesi yok; onay adımı atlanır."])
  )
}

/** The versions shown, accepted before the payment starts; refused when not ticked. */
async function acceptContracts() {
  if (!state.contracts?.length) return
  if (!$("accept").checked) throw new Error("Ödemeden önce sözleşmeleri onaylayın.")
  await api(`/store/carts/${state.cart.id}/legal-consents`, {
    method: "POST",
    body: { documents: state.contracts.map(({ kind, version }) => ({ kind, version })) },
  })
}

/** Whether the cart asks the buyer's age: a restricted product while the shop checks ages. */
async function loadAgeCheck() {
  if (!state.cart) return
  const { age_check: check } = await api(`/store/carts/${state.cart.id}/age-declaration`)
  state.ageRequired = check.required && !check.declared
  $("age-row").hidden = !check.required
  $("age-limit").textContent = check.required
    ? `Sepette yaş sınırlı ürün var: ${check.min_age} yaşını doldurduğunuzu beyan edin.`
    : ""
}

/** The declaration before the payment: the date of birth is checked and not kept. */
async function declareAge() {
  if (!state.ageRequired) return
  if (!$("age-confirm").checked || !$("birth-date").value)
    throw new Error("Doğum tarihinizi girip yaş beyanını onaylayın.")
  await api(`/store/carts/${state.cart.id}/age-declaration`, {
    method: "POST",
    body: { birth_date: $("birth-date").value, confirmed: true },
  })
  state.ageRequired = false
}
