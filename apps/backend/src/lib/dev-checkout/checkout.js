// The payment test page's script (adr/0028): plain browser JavaScript, no build.
/* global showBankTransfer, showCashOnDelivery, followReturn, loadContracts, acceptContracts, loadAgeCheck, declareAge */
const config = JSON.parse(document.getElementById("config").textContent)
const CART_KEY = "qt-dev-checkout-cart"
const $ = (id) => document.getElementById(id)
const money = (amount) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(Number(amount ?? 0))
const state = { region: null, cart: null, contracts: [] }

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props)
  node.append(...children.filter((child) => child !== null && child !== undefined))
  return node
}

function showError(error) {
  $("error").hidden = !error
  $("error").textContent = error ? `Hata: ${error.message ?? error}` : ""
}

// credentials: "omit" — a panel session cookie must not ride along (CSRF guard)
async function api(path, init = {}) {
  const response = await fetch(path, {
    ...init,
    credentials: "omit",
    headers: {
      "content-type": "application/json",
      "x-publishable-api-key": config.publishableKey,
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.message ?? `HTTP ${response.status}`)
  return body
}

async function run(task) {
  showError(null)
  try {
    await task()
  } catch (error) {
    showError(error)
  }
}

async function loadCart() {
  const id = localStorage.getItem(CART_KEY)
  if (!id) return renderCart()
  try {
    state.cart = (await api(`/store/carts/${id}`)).cart
  } catch {
    localStorage.removeItem(CART_KEY)
    state.cart = null
  }
  renderCart()
}

async function cartId() {
  if (state.cart) return state.cart.id
  state.cart = (
    await api("/store/carts", { method: "POST", body: { region_id: state.region.id } })
  ).cart
  localStorage.setItem(CART_KEY, state.cart.id)
  return state.cart.id
}

function renderCart() {
  const cart = state.cart
  if (!cart?.items?.length) return $("cart").replaceChildren("Sepet boş.")
  const lines = cart.items.map((item) =>
    el(
      "div",
      { className: "row" },
      el("span", {}, `${item.product_title} × ${item.quantity}`),
      el(
        "span",
        {},
        money(item.unit_price * item.quantity),
        el("button", {
          type: "button",
          textContent: "−",
          ariaLabel: "Bir azalt",
          onclick: () => run(() => changeLine(item, item.quantity - 1)),
        })
      )
    )
  )
  const total = (label, value, extra = "") =>
    el("div", { className: `row ${extra}` }, el("span", {}, label), el("span", {}, money(value)))
  const rows = [
    ...lines,
    // KDV included and before discounts, as a storefront shows them (Medusa's subtotals exclude tax)
    total(
      "Ara toplam",
      cart.items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0)
    ),
    cart.discount_total > 0 ? total("İndirim", -cart.discount_total) : null,
    total("Kargo", cart.shipping_total),
    total("Toplam (KDV dahil)", cart.total, "total"),
  ]
  $("cart").replaceChildren(...rows.filter(Boolean))
}

async function changeLine(item, quantity) {
  const path = `/store/carts/${state.cart.id}/line-items/${item.id}`
  const body =
    quantity > 0
      ? await api(path, { method: "POST", body: { quantity } })
      : await api(path, { method: "DELETE" })
  state.cart = body.cart ?? body.parent ?? (await api(`/store/carts/${state.cart.id}`)).cart
  renderCart()
}

async function addToCart(variantId) {
  const id = await cartId()
  state.cart = (
    await api(`/store/carts/${id}/line-items`, {
      method: "POST",
      body: { variant_id: variantId, quantity: 1 },
    })
  ).cart
  renderCart()
}

async function loadProducts() {
  const fields = "id,title,thumbnail,variants.id,variants.title,*variants.calculated_price"
  const { products } = await api(
    `/store/products?region_id=${state.region.id}&limit=8&fields=${encodeURIComponent(fields)}`
  )
  $("products").replaceChildren(
    ...products.map((product) => {
      const variants = product.variants ?? []
      const select = el(
        "select",
        { ariaLabel: "Varyant" },
        ...variants.map((variant) =>
          el("option", {
            value: variant.id,
            textContent: `${variant.title} · ${money(variant.calculated_price?.calculated_amount)}`,
          })
        )
      )
      return el(
        "div",
        { className: "product" },
        product.thumbnail ? el("img", { src: product.thumbnail, alt: "" }) : null,
        el("strong", { textContent: product.title }),
        select,
        el("button", {
          type: "button",
          textContent: "Sepete ekle",
          onclick: () => run(() => addToCart(select.value)),
        })
      )
    })
  )
}

async function saveAddress(event) {
  event.preventDefault()
  const form = Object.fromEntries(new FormData($("address")))
  const { email, ...address } = form
  const shipping = { ...address, country_code: "tr" }
  const id = await cartId()
  state.cart = (
    await api(`/store/carts/${id}`, {
      method: "POST",
      body: { email, shipping_address: shipping, billing_address: shipping },
    })
  ).cart
  renderCart()
  await loadShipping()
}

async function loadShipping() {
  const { shipping_options: options } = await api(
    `/store/shipping-options?cart_id=${state.cart.id}`
  )
  const chosen = state.cart.shipping_methods?.[0]?.shipping_option_id
  $("shipping").replaceChildren(
    ...(options.length
      ? options.map((option) =>
          el(
            "label",
            { className: "choice" },
            el("input", {
              type: "radio",
              name: "shipping",
              checked: option.id === chosen,
              onchange: () =>
                run(async () => {
                  state.cart = (
                    await api(`/store/carts/${state.cart.id}/shipping-methods`, {
                      method: "POST",
                      body: { option_id: option.id },
                    })
                  ).cart
                  renderCart()
                  await Promise.all([loadInstallments(), loadContracts(), loadAgeCheck()])
                }),
            }),
            `${option.name} · ${money(option.calculated_price?.calculated_amount ?? option.amount)}`
          )
        )
      : ["Bu adrese kargo seçeneği yok."])
  )
}

async function loadInstallments() {
  const { installments } = await api(`/store/payment/installments?cart_id=${state.cart.id}`)
  const family = installments.families[0]
  $("installments").textContent =
    installments.enabled && family
      ? `Taksit (${family.family}): ` +
        family.options.map((option) => `${option.count}× ${money(option.total)}`).join(" · ")
      : "Taksit kapalı: tek çekim."
}

async function pay() {
  if (!state.cart) throw new Error("Sepet boş.")
  const provider = document.querySelector("input[name=provider]:checked").value
  const back = (result) => `${location.origin}/dev/checkout?sonuc=${result}&sepet=${state.cart.id}`
  const offline = provider === "pp_bank-transfer_bank-transfer" || provider === "pp_cod_cod"
  await acceptContracts()
  await declareAge()
  const { payment_session: session } = await api(`/store/carts/${state.cart.id}/payment-session`, {
    method: "POST",
    body: offline
      ? { provider_id: provider }
      : { provider_id: provider, return_urls: { success: back("tamam"), failure: back("hata") } },
  })
  // Bank transfer sends nobody anywhere: the order is placed now, awaiting the money (adr/0029)
  if (offline) {
    const completed = await api(`/store/carts/${state.cart.id}/complete`, { method: "POST" })
    if (completed.type !== "order")
      throw new Error(completed.error?.message ?? "Sipariş açılamadı.")
    localStorage.removeItem(CART_KEY)
    state.cart = null
    renderCart()
    if (provider === "pp_cod_cod") showCashOnDelivery(completed.order, session.data)
    else showBankTransfer(completed.order, session.data)
    $("result").scrollIntoView({ behavior: "smooth" })
    return
  }
  // iyzico's page is a whole page that sends the browser back; PayTR's form lives in an iFrame
  if (provider === "pp_iyzico_iyzico") {
    location.href = session.data.form_url
    return
  }
  $("form").src = session.data.form_url
  $("form").hidden = false
  $("form").scrollIntoView({ behavior: "smooth" })
}

$("address").addEventListener("submit", (event) => run(() => saveAddress(event)))
$("pay").addEventListener("click", () => run(pay))
// The contracts name the way to pay
document
  .querySelectorAll("input[name=provider]")
  .forEach((input) => input.addEventListener("change", () => run(loadContracts)))
$("reset").addEventListener("click", () => {
  localStorage.removeItem(CART_KEY)
  location.href = "/dev/checkout"
})

run(async () => {
  if (!config.publishableKey)
    throw new Error("Demo vitrin anahtarı yok: pnpm --filter backend seed:demo")
  const { regions } = await api("/store/regions")
  state.region = regions.find((region) => region.currency_code === "try") ?? regions[0]
  if (!state.region) throw new Error("Bölge yok: pnpm --filter backend seed:demo")
  await Promise.all([loadProducts(), loadCart()])
  if (state.cart?.shipping_address) await loadShipping()
  if (state.cart?.shipping_methods?.length)
    await Promise.all([loadInstallments(), loadContracts(), loadAgeCheck()])
  const params = new URLSearchParams(location.search)
  if (params.get("sepet")) await followReturn(params)
})
