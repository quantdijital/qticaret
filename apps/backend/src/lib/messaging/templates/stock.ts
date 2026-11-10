import { textsFor } from "../editable/texts"
import type { EditSpec } from "../editable/types"
import { messageText } from "../texts"
import { renderEmail } from "./layout"
import type { MessageTemplate } from "./types"

/** A stock alert's product, as its two e-mails name it. */
export interface StockAlertVars {
  product: string
  /** The variant's name when the product has several; null otherwise. */
  variant: string | null
  /** The product's page on the storefront; null until the shop has a domain. */
  productUrl: string | null
  /** The guest's confirmation link (`stock.alert_confirm` only). */
  confirmUrl: string | null
}

const SAMPLE: StockAlertVars = {
  product: "Örnek ürün",
  variant: "Mavi / M",
  productUrl: "https://magaza.example/urun/ornek",
  confirmUrl: "https://magaza.example/stok-bildirimi/onay?t=ornek",
}

const named = (vars: StockAlertVars): string =>
  vars.variant ? `${vars.product} (${vars.variant})` : vars.product
/**
 * What the shop may reword (adr/0036 Ek 2026-11-10): `{ürün_adı}` is the
 * product with its variant. The confirmation is required: the guest asked
 * for it and nothing reaches them until they confirm.
 */
const stockSpec = (key: string, required: boolean): EditSpec<StockAlertVars> => ({
  group: "stock",
  required,
  tokens: { mağaza_adı: "shop", ürün_adı: "product" },
  fields: {
    subject: `${key}.subject`,
    preheader: `${key}.preheader`,
    heading: `${key}.heading`,
    intro: `${key}.intro`,
  },
  values: (vars, brand) => ({ shop: brand.shopName, product: named(vars) }),
})

const CONFIRM = stockSpec("stock_confirm", true)
const BACK = stockSpec("back_in_stock", false)

/**
 * "Stok bildirimini onaylayın" (F10.5): a guest asked to be told; nothing
 * is sent to the address until it confirms, so no one can sign a stranger up.
 */
export const stockAlertConfirm: MessageTemplate<StockAlertVars> = {
  name: "stock.alert_confirm",
  kind: "transactional",
  channels: ["email"],
  // The link's token is only the event's: a lost one is asked for again
  retry: false,
  editable: CONFIRM,
  email: (vars, brand, context) => {
    const text = textsFor(CONFIRM, vars, brand, context?.own)
    return renderEmail(brand, {
      subject: text("subject"),
      preheader: text("preheader"),
      heading: text("heading"),
      blocks: [
        { kind: "paragraph", text: text("intro") },
        {
          kind: "button",
          label: messageText("stock_confirm.button"),
          url: vars.confirmUrl,
        },
        { kind: "note", text: messageText("stock_confirm.ignore") },
      ],
      footer: messageText("footer.account", { shop: brand.shopName }),
    })
  },
  sample: SAMPLE,
}

/** "Yeniden stokta" (F10.5): sent once per alert, when the variant can be bought again. */
export const backInStock: MessageTemplate<StockAlertVars> = {
  name: "stock.back_in_stock",
  kind: "transactional",
  channels: ["email"],
  retry: true,
  editable: BACK,
  email: (vars, brand, context) => {
    const text = textsFor(BACK, vars, brand, context?.own)
    return renderEmail(brand, {
      subject: text("subject"),
      preheader: text("preheader"),
      heading: text("heading"),
      blocks: [
        { kind: "paragraph", text: text("intro") },
        {
          kind: "button",
          label: messageText("back_in_stock.button"),
          url: vars.productUrl,
        },
        { kind: "note", text: messageText("back_in_stock.once") },
      ],
      footer: messageText("footer.stock", { shop: brand.shopName }),
    })
  },
  sample: { ...SAMPLE, confirmUrl: null },
}
