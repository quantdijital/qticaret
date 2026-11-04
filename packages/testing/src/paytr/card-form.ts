import { BIN_TABLE, FAMILY_NAMES, PREFILLED_CARD, digitsOf, familyOf } from "./cards"
import type { CardFamily } from "./cards"
import type { FakePayment } from "./handlers"
import { escape, lira, lockIcon, paytrPage, scriptJson } from "./page-parts"
import { allowedCounts, chargedAmount } from "./rates"
import type { InstallmentRates } from "./rates"

/**
 * The card form as PayTR's iFrame shows it: the amount, the card's
 * holder, number, expiry and CVV, the installments the card's program
 * offers (listed once the number's first six digits are in), "Ödeme yap".
 * In test mode PayTR fills its test card in, and so does this form.
 */

export interface CardFormValues {
  owner: string
  number: string
  expiry: string
  installments: number
}

export interface CardFormView {
  payment: FakePayment
  rates: InstallmentRates
  /** Where the form posts (its own address, the hidden test flag kept). */
  action: string
  values?: CardFormValues
  error?: string
  notice?: string
}

/** The installment choices for a program, the chosen count checked. */
function optionsHtml(view: CardFormView, family: CardFamily | null, chosen: number): string {
  const { payment, rates } = view
  const counts = allowedCounts(rates, family, payment.maxInstallment)
  const checked = counts.includes(chosen) ? chosen : 1
  return counts
    .map((count) => {
      const total = chargedAmount(rates, family, payment.paymentAmount, count)
      const title =
        count === 1 ? "Tek çekim" : `${String(count)} × ${lira(Math.round(total / count))}`
      return `<label class="option"><input type="radio" name="installments" value="${String(count)}"${count === checked ? " checked" : ""}><span><b>${title}</b><small>Toplam ${lira(total)}</small></span></label>`
    })
    .join("")
}

const SCRIPT = `
(function () {
  var data = JSON.parse(document.getElementById("installments-data").textContent);
  var form = document.querySelector("form");
  var number = form.elements.card_number;
  var expiry = form.elements.expiry;
  var options = document.getElementById("options");
  var program = document.getElementById("program");
  var hint = document.getElementById("hint");
  var current = data.initial;
  function show(family) {
    if (family === current) return;
    current = family;
    var checked = form.querySelector("input[name=installments]:checked");
    options.innerHTML = data.options[family || ""] || data.options[""];
    var again = checked && options.querySelector("input[value='" + checked.value + "']");
    (again || options.querySelector("input")).checked = true;
    program.textContent = family ? data.names[family] : "";
  }
  number.addEventListener("input", function () {
    var digits = number.value.replace(/\\D/g, "").slice(0, 19);
    number.value = digits.replace(/(\\d{4})(?=\\d)/g, "$1 ");
    show(digits.length >= 6 ? data.bins[digits.slice(0, 6)] || null : null);
    hint.hidden = digits.length >= 6;
  });
  expiry.addEventListener("input", function () {
    var digits = expiry.value.replace(/\\D/g, "").slice(0, 4);
    expiry.value = digits.length > 2 ? digits.slice(0, 2) + "/" + digits.slice(2) : digits;
  });
})();
`

/** The form for a pending payment, as PayTR's iFrame first shows it. */
export function cardFormPage(view: CardFormView): string {
  const { payment, rates } = view
  const prefilled = payment.testMode
    ? {
        owner: PREFILLED_CARD.owner,
        number: PREFILLED_CARD.number,
        expiry: PREFILLED_CARD.expiry,
        installments: 1,
      }
    : { owner: "", number: "", expiry: "", installments: 1 }
  const values = view.values ?? prefilled
  const digits = digitsOf(values.number)
  const family = digits.length >= 6 ? familyOf(digits) : null
  const families = Object.keys(rates).filter((name): name is CardFamily => name in FAMILY_NAMES)
  const options: Record<string, string> = { "": optionsHtml(view, null, values.installments) }
  for (const name of families) {
    options[name] = optionsHtml(view, name, values.installments)
  }
  const data = { initial: family, bins: BIN_TABLE, names: FAMILY_NAMES, options }
  const cvv = payment.testMode && !view.values ? PREFILLED_CARD.cvv : ""
  const spaced = digits.replace(/(\d{4})(?=\d)/g, "$1 ")
  const body = `<main>
  <div class="top"><div><small>Ödenecek tutar</small><strong>${lira(payment.paymentAmount)}</strong></div><span class="secure">${lockIcon()}Güvenli ödeme</span></div>
  ${view.error ? `<p class="error" role="alert">${escape(view.error)}</p>` : ""}${view.notice ? `<p class="notice" role="status">${escape(view.notice)}</p>` : ""}
  <form method="post" action="${escape(view.action)}" autocomplete="on">
    <div class="field"><label for="cc_owner">Kart üzerindeki ad soyad</label><input id="cc_owner" name="cc_owner" autocomplete="cc-name" maxlength="50" required value="${escape(values.owner)}"></div>
    <div class="field"><label for="card_number">Kart numarası</label><div class="number"><input id="card_number" name="card_number" inputmode="numeric" autocomplete="cc-number" placeholder="0000 0000 0000 0000" maxlength="23" required value="${escape(spaced)}"><span id="program" class="program">${family ? FAMILY_NAMES[family] : ""}</span></div></div>
    <div class="row">
      <div class="field"><label for="expiry">Son kullanma tarihi</label><input id="expiry" name="expiry" inputmode="numeric" autocomplete="cc-exp" placeholder="AA/YY" maxlength="5" required value="${escape(values.expiry)}"></div>
      <div class="field"><label for="cvv">CVV</label><input id="cvv" name="cvv" inputmode="numeric" autocomplete="cc-csc" placeholder="•••" maxlength="4" required value="${cvv}"></div>
    </div>
    <fieldset><legend>Taksit seçenekleri</legend>
      <div id="options" class="options">${options[family ?? ""] ?? options[""] ?? ""}</div>
      <p id="hint" class="hint"${family || digits.length >= 6 ? " hidden" : ""}>Kartınızın taksit seçenekleri, kart numarasını yazdığınızda listelenir.</p>
    </fieldset>
    <button type="submit">Ödeme yap</button>
  </form>
  <footer><p>Ödemeyi onaylamanız için bankanız 3D Secure şifresi isteyecek. Kart bilgileriniz mağazayla paylaşılmaz.</p><p class="brands">PayTR güvencesiyle · VISA · MASTERCARD · TROY · AMEX</p></footer>
</main><script type="application/json" id="installments-data">${scriptJson(data)}</script>`
  return paytrPage("Güvenli ödeme | PayTR", body, SCRIPT)
}
