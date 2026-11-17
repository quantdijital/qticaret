import type { Translate } from "@qticaret/ui"

/**
 * The product page's words for its client parts (docs/19 §6.2: a client
 * component gets its words translated, never `t`), and the action's
 * message keys each part can come back with.
 */

/** The add-to-cart action's refusals, a gift card's recipient's and a line's add-on picks'. */
const CART_ERRORS = [
  "cart.add_failed",
  "cart.variant_unavailable",
  "cart.quantity_invalid",
  "cart.insufficient_stock",
  "errors.too_many_requests",
  "cart.payment_link_locked",
  "gift_card.recipient_email_invalid",
  "gift_card.text_too_long",
  "gift_card.text_invalid",
  "gift_card.text_link",
  "gift_card.sale_disabled",
  "gift_card.not_gift_line",
  "messaging.email_domain_refuses",
  "addons.unknown",
  "addons.duplicate",
  "addons.text_required",
  "addons.text_too_long",
  "addons.charset",
  "addons.text_link",
  "addons.max_quantity",
  "addons.not_addon_line",
  "addons.required",
  "addons.unavailable",
  "addons.too_many",
  "cart.line_unknown",
  "catalog.addons_disabled",
]

const wordsOf = (t: Translate, keys: readonly string[]) =>
  Object.fromEntries(keys.map((key) => [key, t(key)]))

/** The buy column's words; `percents`: the variants' own discounts, each "%30 indirim". */
export const buyWords = (t: Translate, percents: readonly number[]) => ({
  quantity: t("product.quantity"),
  decrease: t("product.decrease"),
  increase: t("product.increase"),
  add: t("product.add_to_cart"),
  adding: t("product.adding"),
  added: t("product.added"),
  goToCart: t("product.go_to_cart"),
  outOfStock: t("product.out_of_stock"),
  chooseOptions: t("product.choose_options"),
  before: t("price.before"),
  saving: t("product.saving"),
  errors: wordsOf(t, CART_ERRORS),
  fallback: t("cart.add_failed"),
  discount: Object.fromEntries(
    percents.map((percent) => [percent, t("product.discount", { percent })])
  ) as Record<number, string>,
  bar: t("product.buy_bar"),
  notify: t("product.alert_submit"),
})

export type BuyWords = ReturnType<typeof buyWords>

export const addonWords = (t: Translate) => ({
  title: t("addons.title"),
  perUnit: t("addons.per_unit"),
  required: t("addons.required_mark"),
  none: t("addons.none"),
  nonWithdrawable: t("addons.non_withdrawable"),
  total: t("addons.total"),
  totalCount: t("addons.total_count"),
  limit: t("addons.max_quantity_hint"),
})

export type AddonWords = ReturnType<typeof addonWords>

export const giftWords = (t: Translate) => ({
  title: t("gift.title"),
  email: t("gift.recipient_email"),
  name: t("gift.recipient_name"),
  message: t("gift.message"),
  messageHint: t("gift.message_hint"),
  sender: t("gift.sender_name"),
  /** The examples inside the fields. */
  placeholders: {
    email: t("placeholder.email"),
    name: t("placeholder.gift_name"),
    message: t("placeholder.gift_message"),
    sender: t("placeholder.sender_name"),
  },
})

export type GiftWords = ReturnType<typeof giftWords>

export const installmentWords = (t: Translate) => ({
  title: t("product.installments"),
  loading: t("product.installments_loading"),
  none: t("product.installments_none"),
  count: t("product.installments_count"),
  per: t("product.installments_per"),
  total: t("product.installments_total"),
  single: t("product.installments_single"),
  /** "{count} aya varan taksit". */
  upTo: t("product.installments_up_to"),
  /** "{count} taksit": the same in a narrow column (a phone). */
  short: t("product.installments_short"),
  /** "aylık {amount}'den". */
  monthly: t("product.installments_monthly"),
  family: t("product.installments_family"),
  free: t("product.installments_free"),
  note: t("product.installments_note"),
  close: t("product.installments_close"),
})

export type InstallmentWords = ReturnType<typeof installmentWords>

export const alertWords = (t: Translate) => ({
  title: t("product.alert_title"),
  email: t("checkout.email"),
  submit: t("product.alert_submit"),
  sent: t("product.alert_sent"),
  sentGuest: t("product.alert_sent_guest"),
  errors: wordsOf(t, [
    "stock_alerts.in_stock",
    "stock_alerts.not_tracked",
    "checkout.email_invalid",
    "errors.too_many_requests",
    "errors.challenge_failed",
  ]),
  fallback: t("product.alert_failed"),
})

export type AlertWords = ReturnType<typeof alertWords>

export const favoriteWords = (t: Translate) => ({
  add: t("product.favorite_add"),
  added: t("product.favorite_added"),
  errors: wordsOf(t, ["product.sign_in_first", "wishlist.full"]),
  fallback: t("product.favorite_failed"),
})

export type FavoriteWords = ReturnType<typeof favoriteWords>

export const galleryWords = (t: Translate) => ({
  label: t("product.images"),
  noImage: t("product.no_image"),
  zoom: t("product.zoom"),
  close: t("product.zoom_close"),
  previous: t("product.image_previous"),
  next: t("product.image_next"),
  /** "{n} / {count}". */
  position: t("product.image_position"),
  /** "Görsel {n}". */
  show: t("product.image_show"),
  thumbsPrevious: t("product.thumbs_previous"),
  thumbsNext: t("product.thumbs_next"),
  /** A video's own button (adr/0069 §7): "Videoyu oynat", shown while it does not play. */
  videoPlay: t("product.video_play"),
  /** Its accessible name, playing or not: "Videoyu oynat: {title}", "Videoyu durdur: {title}". */
  videoPlayNamed: t("product.video_play_named"),
  videoPauseNamed: t("product.video_pause_named"),
  /** A video's thumbnail: "Video: {title}". */
  videoShow: t("product.video_show"),
  /** A YouTube video's line before it is pressed (adr/0069 §7): where it will load from. */
  videoYoutubeNote: t("product.video_youtube_note"),
  /** The YouTube player's accessible name once pressed: "YouTube videosu: {title}". */
  videoYoutubeFrame: t("product.video_youtube_frame"),
})

export type GalleryWords = ReturnType<typeof galleryWords>

/** The description and specs block: its tabs' name and the description's own toggle. */
export const infoWords = (t: Translate) => ({
  tabs: t("product.info_tabs"),
  description: t("product.description"),
  specs: t("product.specs"),
  more: t("product.read_more"),
  less: t("product.read_less"),
})

export type InfoWords = ReturnType<typeof infoWords>

export const communityWords = (t: Translate) => ({
  rating: t("product.rating"),
  stars: Object.fromEntries([1, 2, 3, 4, 5].map((n) => [n, t("reviews.stars", { rating: n })])),
  reviewTitle: t("product.review_title"),
  reviewBody: t("product.review_body"),
  send: t("product.send"),
  sending: t("checkout.saving"),
  reviewSent: t("product.review_sent"),
  questionBody: t("product.question_body"),
  ask: t("product.ask"),
  questionSent: t("product.question_sent"),
  addPhotos: t("reviews.photos_label"),
  photosHint: t("reviews.photos_hint"),
  errors: wordsOf(t, [
    "product.sign_in_first",
    "product.rating_required",
    "product.review_too_short",
    "product.question_too_short",
    "reviews.not_purchased",
    "reviews.already_reviewed",
    "reviews.photo_unknown",
    "reviews.photos_too_many",
    "reviews.photo_uploads_full",
    "product.review_photos_invalid",
    "errors.too_many_requests",
  ]),
  reviewFailed: t("product.review_failed"),
  questionFailed: t("product.question_failed"),
})

export type CommunityWords = ReturnType<typeof communityWords>

/** The reviews' list on the product page: the spread as filters, the order, the rest on demand. */
export const reviewListWords = (t: Translate) => ({
  stars: Object.fromEntries(
    [1, 2, 3, 4, 5].map((n) => [n, t("reviews.stars", { rating: n })])
  ) as Record<number, string>,
  verified: t("product.verified"),
  photos: t("reviews.photos"),
  /** "Mağazanın yanıtı". */
  reply: t("reviews.shop_reply"),
  /** "{author} adlı müşterinin fotoğrafı {n}". */
  photoAlt: t("reviews.photo_alt"),
  distribution: t("reviews.distribution"),
  filterLabel: t("reviews.filter_label"),
  /** "{stars} yıldız". */
  barStars: t("reviews.bar_stars"),
  filterShown: t("reviews.filter_shown"),
  /** "Filtreyi kaldır: {label}". */
  filterClear: t("reviews.filter_clear"),
  filterAll: t("reviews.filter_all"),
  filterEmpty: t("reviews.filter_empty"),
  sort: t("reviews.sort"),
  newest: t("reviews.sort_newest"),
  highest: t("reviews.sort_highest"),
  lowest: t("reviews.sort_lowest"),
  more: t("product.reviews_more"),
})

export type ReviewListWords = ReturnType<typeof reviewListWords>
