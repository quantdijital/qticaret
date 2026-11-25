import { model } from "@medusajs/framework/utils"
import {
  POPUP_DESIGNS,
  POPUP_DEVICES,
  POPUP_FREQUENCIES,
  POPUP_LAYOUTS,
  POPUP_MEMBERSHIPS,
  POPUP_PAGE_SCOPES,
  POPUP_TRIGGERS,
  POPUP_TYPES,
  POPUP_VISITORS,
} from "../../../lib/popups/rules"

/**
 * One storefront pop-up (adr/0080): what it says, where and to whom it
 * shows, when it opens and how often. Plain text only; the picture is one
 * of the media library's, by its address. A campaign pop-up names a Medusa
 * promotion whose code it shows, read live: an ended campaign hides it.
 */
export const Popup = model
  .define("popup", {
    id: model.id({ prefix: "popup" }).primaryKey(),
    /** The panel's name for it; never on the storefront. */
    name: model.text(),
    type: model.enum([...POPUP_TYPES]),
    is_active: model.boolean().default(false),
    starts_at: model.dateTime().nullable(),
    ends_at: model.dateTime().nullable(),
    /** The higher first when two could open on one page. */
    priority: model.number().default(0),
    title: model.text(),
    body: model.text().nullable(),
    image_url: model.text().nullable(),
    image_alt: model.text().nullable(),
    /** The button's words; a newsletter pop-up's submit button. */
    button_label: model.text().nullable(),
    /** A path on the shop or an https address; never on a newsletter pop-up. */
    button_href: model.text().nullable(),
    /** A campaign pop-up's Medusa promotion. */
    promotion_id: model.text().nullable(),
    page_scope: model.enum([...POPUP_PAGE_SCOPES]).default("all"),
    /** `PopupPage[]` while `page_scope` is `selected`. */
    pages: model.json(),
    device: model.enum([...POPUP_DEVICES]).default("all"),
    visitor: model.enum([...POPUP_VISITORS]).default("any"),
    membership: model.enum([...POPUP_MEMBERSHIPS]).default("any"),
    trigger: model.enum([...POPUP_TRIGGERS]).default("delay"),
    trigger_value: model.number().default(5),
    frequency: model.enum([...POPUP_FREQUENCIES]).default("days"),
    frequency_days: model.number().nullable(),
    layout: model.enum([...POPUP_LAYOUTS]).default("modal"),
    /** How it looks inside (adr/0080 §6a); `classic` for every pop-up made before. */
    design: model.enum([...POPUP_DESIGNS]).default("classic"),
  })
  .indexes([{ on: ["is_active"], where: "deleted_at IS NULL" }])
