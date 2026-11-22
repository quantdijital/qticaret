/** English texts of the API's error keys; the same keys as `tr.ts`. */
export const SERVER_ERROR_MESSAGES_EN: Readonly<Record<string, string>> = {
  "async_job.already_running": "One of these jobs is already queued or running.",
  "async_job.input_invalid": "The job's options are not valid.",
  "async_job.cancelled": "The job was cancelled.",
  "async_job.not_open": "The job has already finished; it cannot be cancelled.",
  "async_job.not_queued": "The job has already started.",
  "async_job.not_yours": "Only whoever started this job, or the shop's owner, can cancel it.",
  "async_job.result_unavailable": "This job has no result to download, or it expired.",
  "async_job.unknown": "Job not found.",
  "async_job.type_unknown": "There is no such job type.",
  "audit_log.kind_invalid": "The entry kind is not valid.",
  "billing_profile.unknown": "This customer has no billing details.",
  "billing_profile.tax_id_invalid": "The tax or national ID number is not valid.",
  "billing_profile.tax_office_required": "Enter the tax office.",
  "bank_transfer.not_configured":
    "The shop has not turned on bank transfer or entered its account.",
  "bank_transfer.iban_invalid":
    "The IBAN is not valid. Check the 26-character IBAN starting with TR.",
  "bank_transfer.incomplete":
    "Turning on bank transfer needs the account holder, the bank name and the IBAN.",
  "payments.return_urls_required": "Card payments need return addresses.",
  "payments.return_urls_unexpected": "This way to pay takes no return addresses.",
  "cart.metadata_reserved": "This line detail is set by the shop only.",
  "bank_transfer.not_this_order": "This order was not paid by bank transfer.",
  "bank_transfer.order_canceled": "A cancelled order's transfer cannot be confirmed.",
  "notifications.read_target": "Choose the notifications to mark read, or mark them all.",
  "orders.cancel_after_packing":
    "An order packed or shipped cannot be cancelled; once it arrives, ask for a return.",
  "orders.cancel_contact_shop":
    "An order paid by bank transfer cannot be cancelled here; contact the shop to cancel it and get the money back.",
  "orders.gift_card_used":
    "A gift card from this order has been used, so the order cannot be cancelled; contact the shop about a refund.",
  "orders.ship_canceled_refund":
    "This order's cancellation has already been refunded; it cannot be shipped. Cancel the order.",
  "orders.edit_nothing": "Nothing was chosen to change.",
  "orders.edit_items_invalid": "The edited lines are not this order's, or one was chosen twice.",
  "orders.edit_after_packing": "An order packed, shipped or cancelled cannot be edited.",
  "orders.edit_invoiced":
    "This order's invoice is issued or on its way; the order can no longer be edited.",
  "orders.edit_payment_unsupported":
    "This order's lines cannot be edited: only orders paid by card can. For cash on delivery and bank transfer, cancel the order and place a new one.",
  "orders.edit_difference_changed":
    "The edit's price difference changed; refresh the preview and try again.",
  "orders.edit_difference_due":
    "The shopper owes a difference; collect it and tick it before saving.",
  "orders.edit_price_kurus": "A price may have at most two decimals.",
  "orders.use_order_edit": "Orders are edited from the edit dialog on the order page only.",
  "orders.ship_items_invalid":
    "The chosen lines do not match what is left to ship: at most what is left of each line can go.",
  "orders.tracking_invalid":
    "Invalid tracking: a carrier name, a 4–40 character tracking number and an https link.",
  "orders.nothing_to_deliver": "No parcel of the shop's own delivery waits to be delivered.",
  "orders.deliver_failed": "The order could not be marked delivered; try again on its page.",
  "orders.wholesaler_filter_denied": "Only the shop owner and admins can filter by wholesaler.",
  "orders.range_invalid":
    "Invalid date range: days as YYYY-MM-DD, and the start cannot come after the end.",
  "orders.note_unknown": "Note not found; it may have been removed.",
  "orders.note_not_yours": "Only the note's author or the shop owner can remove it.",
  "orders.note_empty": "A note cannot be empty.",
  "orders.note_too_long": "A note can be at most 2000 characters.",
  "orders.ship_failed": "The order could not be shipped; try again from its page.",
  "orders.payment_awaited":
    "The order's payment has not come yet; it can be shipped once the transfer is confirmed.",
  "cash_on_delivery.disabled": "The shop does not offer cash on delivery.",
  "cash_on_delivery.over_limit": "An order of this amount cannot be paid on delivery.",
  "cash_on_delivery.shipping_unsupported":
    "The chosen courier does not collect on delivery; pick another to pay at the door.",
  "cash_on_delivery.fee_line_locked":
    "The cash on delivery fee cannot be changed in the cart; pick another way to pay.",
  "cash_on_delivery.fee_mismatch": "The cash on delivery fee changed; start the payment again.",
  "cash_on_delivery.fee_invalid": "A share is at most 100%.",
  "chargebacks.order_unpaid":
    "This order has no captured card payment; no chargeback can be recorded.",
  "chargebacks.changed": "The record changed meanwhile; refresh and try again.",
  "chargebacks.amount_exceeds_paid": "The disputed amount cannot exceed what was paid.",
  "chargebacks.amount_invalid": "Enter the amount with at most two decimals.",
  "chargebacks.already_open": "This payment already has an open chargeback.",
  "chargebacks.transition_invalid":
    "The chargeback cannot move to this state; a closed one does not reopen.",
  "chargebacks.unknown": "Chargeback not found.",
  "brands.description_invalid":
    "The description is too long or holds characters that cannot be used.",
  "brands.logo_unknown": "Choose the logo from the media library: it must be an image there.",
  "brands.name_invalid": "Enter the brand's name (120 characters at most).",
  "brands.name_taken": "A brand with this name already exists.",
  "brands.unknown": "Brand not found.",
  "bulk_edit.alt_not_filled":
    "Some images' alt text could not be written; add it on the product page.",
  "bulk_edit.category_unknown": "The chosen category was not found.",
  "bulk_edit.cost_out_of_range": "The new cost is over the limit.",
  "bulk_edit.no_cost": "Its variants have no cost; enter one before changing it by a percent.",
  "bulk_edit.no_location": "No default warehouse is set for stock.",
  "bulk_edit.no_price": "Its variants have no TRY price; enter a price first.",
  "bulk_edit.price_out_of_range": "The new price would fall below zero or pass the limit.",
  "bulk_edit.product_missing": "Product not found; it may have been deleted.",
  "bulk_edit.stock_negative": "The new stock would fall below zero.",
  "bulk_edit.stock_out_of_range": "The new stock would pass the limit.",
  "bulk_edit.stock_untracked": "This product's stock is not tracked.",
  "cart.address_required": "An address is needed to complete the order.",
  "cart.insufficient_stock": "There are not as many of this item in stock as you asked for.",
  "cart.out_of_stock":
    "This item just sold out: {{name}}. Remove it from your cart or lower its quantity.",
  "cart.shipping_changed":
    "The shipping price changed with your basket; choose shipping again and retry.",
  "cart.shipping_not_needed": "Nothing in the cart needs shipping; remove the shipping method.",
  "catalog_import.attribute_invalid":
    "The value does not fit this attribute (one of its options, a number or Yes/No).",
  "catalog_import.attribute_required": "A required attribute of the template is empty.",
  "catalog_import.attribute_unknown": "The product's template has no such attribute.",
  "catalog_import.brand_unknown": "No brand has this handle.",
  "catalog_import.vat_unknown":
    "No VAT rate has this name or percentage; write its name as the VAT rates screen lists it (e.g. KDV %10) or its percentage (e.g. 10).",
  "catalog_import.vat_ambiguous":
    "Several VAT rates have this percentage; write the rate's name as the VAT rates screen lists it.",
  "catalog_import.category_unknown": "One of the categories has no such handle.",
  "catalog_import.collection_unknown": "No collection has this handle.",
  "catalog_import.column_repeated": "This column is in the file twice; the second was not read.",
  "catalog_import.columns_missing":
    'The file has no "Tanıtıcı" or "Ürün adı" column; use the template.',
  "catalog_import.dimension_invalid":
    "A measurement is zero or a positive number (3 decimals at most).",
  "catalog_import.handle_exists":
    'A product already has the handle made from this title; fill in "Tanıtıcı" to update it.',
  "catalog_import.handle_invalid":
    "A handle holds only lowercase letters, digits and hyphens (e.g. ceramic-mug).",
  "catalog_import.handle_or_title_required": "The row has neither a handle nor a product name.",
  "catalog_import.handle_repeated":
    "Two rows without a handle have the same product name; give them handles.",
  "catalog_import.no_location":
    "The shop has no default warehouse, so stock cannot be written. Add one under Settings > Warehouses.",
  "catalog_import.no_measures": "No measures; shipping is priced by the default parcel.",
  "catalog_import.option_incomplete": "An option's name and value go together.",
  "catalog_import.option_unknown": "The product has no option of this name.",
  "catalog_import.option_value_unknown":
    "A new option value; add it to the product in the panel first.",
  "catalog_import.options_differ": "A product's rows carry the same option names.",
  "catalog_import.price_invalid":
    "A price is zero or a positive amount (2 decimals at most, e.g. 1.250,50).",
  "catalog_import.product_field_conflict":
    "Another row of the same product gives this field another value.",
  "catalog_import.sku_repeated": "This SKU was used earlier in the file.",
  "catalog_import.sku_taken": "Another product's variant uses this SKU.",
  "catalog_import.status_invalid": 'The status is "Taslak" or "Yayında".',
  "catalog_import.stock_invalid":
    "Stock is zero or a positive whole number; write Takipsiz for a variant whose stock is not counted.",
  "catalog_import.stock_untracked":
    "This variant does not track its stock; no quantity can be set.",
  "catalog_import.stock_untracked_reserved":
    "Open orders hold this variant's stock; its tracking cannot be turned off until they are settled.",
  "catalog_import.template_change":
    "The product has another attribute template; change it in the panel.",
  "catalog_import.template_required": "Choose an attribute template to fill attributes.",
  "catalog_import.template_unknown": "No attribute template has this handle.",
  "catalog_import.text_invalid": "Text cannot hold invisible control characters.",
  "catalog_import.text_too_long": "The text is too long for this field.",
  "catalog_import.title_required": "A new product needs a product name.",
  "catalog_import.variant_repeated": "Two rows have the same option values.",
  "catalog_import.variant_unmatched":
    "The row matches none of the product's variants; give its SKU or all of the product's options.",
  "catalog_import.write_failed": "The product could not be saved.",
  "catalog.handle_invalid": "The handle may contain only lowercase letters, digits and hyphens.",
  "catalog.handle_required": "No handle could be made from the title; enter one yourself.",
  "catalog.kind_disabled": "Turn on digital and service products in Settings > Features first.",
  "catalog.mpn_invalid": "The MPN contains invalid characters.",
  "catalog.primary_category_not_assigned":
    "The primary category must be one of the product's categories.",
  "catalog.product_unknown": "Product not found.",
  "catalog.successor_loop": "This choice would create a redirect loop.",
  "catalog.successor_self": "A product cannot succeed itself.",
  "catalog.successor_unknown": "The selected product was not found.",
  "catalog.variant_image_unknown": "A variant picture is not among the product's pictures.",
  "catalog.variant_image_variant_unknown":
    "A variant picture names a variant the product does not have.",
  "catalog.variant_images_invalid": "The variant pictures could not be read.",
  "catalog.variant_unknown": "The variant does not belong to this product.",
  "catalog.variants_too_many": "At most 500 variants can be saved at once.",
  "content.author_invalid":
    "The author name must be at most 120 characters, without disallowed characters.",
  "content.author_bio_invalid":
    "The bio must be at most 2000 characters, without disallowed characters.",
  "content.author_handle_taken":
    "Another author uses this address; write a different name or address.",
  "content.author_job_title_invalid":
    "The job title must be at most 120 characters, without disallowed characters.",
  "content.author_link_invalid":
    "The link must be a valid address starting with https; LinkedIn, Instagram and X links must be on that site.",
  "content.author_name_invalid":
    "An author name is required, at most 120 characters, without disallowed characters.",
  "content.author_post_only": "Authors can be added to blog posts only.",
  "content.author_unknown": "Author not found; reload the list and choose again.",
  "content.author_user_unknown": "The chosen staff account was not found.",
  "content.body_invalid":
    "The content holds an element or format that is not allowed; reload the page and try again.",
  "content.card_unknown":
    "One of the product or category cards in the content no longer exists; remove it.",
  "content.token_unknown":
    "The text has details that are not known: {{tokens}}. Available: {mağaza_adı}, {telefon}, {e_posta}, {adres}, {whatsapp}, {ücretsiz_kargo_eşiği}.",
  "content.excerpt_invalid":
    "The summary must be at most 500 characters, without disallowed characters.",
  "content.image_alt_invalid": "The cover image's alt text must be at most 300 characters.",
  "content.image_unknown":
    "Images must come from the shop's media library; upload the image to add it.",
  "content.landing_category_unknown": "Category not found.",
  "content.landing_category_unlisted": "The category has no address yet; save the category first.",
  "content.landing_exists": "A page for this category and filter already exists.",
  "content.landing_facet_unknown":
    "Filter not found: choose a brand or a filterable choice attribute.",
  "content.landing_unknown": "Filter page not found.",
  "content.tags_too_many": "A post can have at most 50 tags.",
  "content.term_description_invalid":
    "The description must be at most 1000 characters, without disallowed characters.",
  "content.term_handle_taken":
    "Another category or tag uses this address; write a different name or address.",
  "content.term_name_invalid":
    "A name is required, at most 120 characters, without disallowed characters.",
  "content.term_unknown":
    "The chosen category or tag was not found; reload the list and choose again.",
  "content.terms_post_only": "Categories and tags can be added to blog posts only.",
  "content.title_invalid":
    "A title is required, at most 200 characters, without disallowed characters.",
  "content.too_large":
    "The content is too long or too deeply nested; a page can hold at most 200,000 characters and a few levels of nested lists.",
  "content.unknown": "Content not found.",
  "content.page_text_in_editor":
    "A page's text is edited in the theme editor, in the page's sections; only its title, address, cover and status are saved here.",
  "errors.busy": "The record is being updated by another action; try again in a few seconds.",
  "errors.conflict": "The record changed meanwhile; reload and try again.",
  "errors.csrf_rejected": "The request failed a security check; reload the page and try again.",
  "errors.duplicate": "Another record already uses this value.",
  "errors.invalid_data": "The data is not valid; check the fields.",
  "errors.invalid_limit": "The page size must be a plain number.",
  "errors.invalid_reference": "The selected record was not found.",
  "errors.invalid_request": "The request could not be understood.",
  "errors.length_required": "The request size is required.",
  "errors.limit_too_large": "Too many records were asked for at once.",
  "errors.not_found": "The record was not found.",
  "errors.provider_unavailable": "The connected service cannot be reached; try again shortly.",
  // The admin API's provider failure; the dashboard names the service (messages/provider.ts)
  "provider.failed": "The connected service did not complete the request; try again shortly.",
  "errors.request_too_large": "The file or data sent is too large.",
  "errors.temporarily_unavailable": "The service is temporarily unavailable; try again shortly.",
  "errors.too_many_requests": "Too many attempts. Wait a moment and try again.",
  "errors.users_only": "Only signed-in admin users can do this.",
  "features.disabled": "This feature is turned off.",
  "features.platform_owned": "This feature is managed by the platform.",
  "features.unknown": "There is no such feature.",
  "gift_cards.code_prefix":
    "A card code's prefix is up to 20 letters, digits or dashes; the rest of the code is drawn at random.",
  "gift_cards.guest_account":
    "Store credit is for customers with an account; a guest could not spend it.",
  "gift_cards.no_expiry": "Gift cards do not expire; a card cannot be given a last day.",
  "gift_card.sale_disabled":
    "The shop does not sell gift cards right now; remove the gift card from the cart.",
  "gift_card.recipient_required": "Enter the recipient's e-mail for every gift card in the cart.",
  "gift_card.not_payable_with_credit":
    "A gift card cannot be bought with a gift card or store credit; remove the card or the credit from the cart.",
  "gift_card.not_gift_line": "This line is not a gift card.",
  "gift_card.recipient_email_invalid": "The recipient's e-mail address is not valid.",
  "gift_card.text_too_long": "A name may be 60 characters at most, a message 300.",
  "gift_card.text_invalid": "The text contains a character that cannot be used.",
  "gift_card.text_link": "Names and the message cannot contain a link, a web address or an e-mail.",
  "gift_card.unknown": "No gift card was found for this code.",
  "catalog.gift_card_disabled": "Turn on gift cards in Settings > Features first to sell them.",
  "catalog.gift_card_kind": "A gift card is a digital product; its kind cannot change.",
  "catalog.core_gift_card":
    "To make a product a gift card, use the 'Gift card' option on the product page.",
  "cart.line_unknown": "This line is not in the cart.",
  "cart.prices_changed":
    "The price of some items in the cart changed. Check the new total and start the payment again.",
  "catalog.description_blocks":
    "A product description takes no pictures or product and category cards; add pictures to the product's images.",
  "catalog.description_one_of":
    "Send the description either as plain text or as formatted text, not both.",
  "catalog.listing_description_blocks":
    "A description takes no pictures or product and category cards; headings, paragraphs, lists, tables and links are fine.",
  "catalog.summary_blocks":
    "A short description takes paragraphs, small headings (H3, H4), lists, bold, italic and links; no large headings, quotes, tables or pictures.",
  "catalog.summary_too_long": "A short description has 1,500 characters at most.",
  "catalog.summary_link":
    "Links in the short description go to the shop's own pages or to addresses starting with https://.",
  "catalog.addons_disabled":
    "Add-ons are off. Turn them on in Settings > Features; remove items with add-ons from the cart.",
  "addons.id_invalid": "The add-on's id is not valid.",
  "addons.id_duplicate": "The same id is used twice.",
  "addons.label_invalid": "A name is 1-60 characters, without invisible characters.",
  "addons.help_invalid": "A description is at most 160 characters.",
  "addons.price_invalid": "A price is between 0 and 10,000 TL, with at most two decimals.",
  "addons.max_quantity_invalid": "The limit per line is between 1 and 99.",
  "addons.text_rules_invalid": "A text's length is between 1 and 200 characters.",
  "addons.choices_invalid": "A choice add-on has 2-10 options.",
  "addons.too_many": "A product has at most 5 add-ons.",
  // adr/0076: dated products
  "catalog.booking_disabled":
    "Turn on both dated products and digital and service products in Settings > Features first.",
  "catalog.booking_kind":
    "A dated product must be a service; stop selling it by date before changing its kind.",
  "catalog.booking_range_unavailable":
    "Selling by date range (stays, rentals) is not available yet.",
  "booking.product_not_dated":
    "This product is not sold by date; set it to sell by departure first.",
  "booking.variant_unknown": "The variant chosen is not this product's.",
  "booking.slot_unknown": "The departure was not found.",
  "booking.slot_full": "Not enough places are left on this departure.",
  "booking.slot_closed": "This departure is closed for sale.",
  "booking.slot_dates_invalid": "The end must come after the start.",
  "booking.capacity_below_sold": "The capacity cannot go below the places sold and held in carts.",
  "booking.units_invalid": "The number of people must be a whole number from 1 to 10,000.",
  "booking.hold_minutes_invalid": "A hold lasts from 1 to 120 minutes.",
  "booking.hold_missing": "The places held in your cart have expired; choose the date again.",
  "booking.hold_used": "These held places belong to another order.",
  "booking.unknown": "The booking was not found.",
  "booking.cancellation_tiers_invalid":
    "Cancellation tiers cannot repeat a day count; ten tiers at most.",
  "booking.pax_ages_invalid": "The lowest age cannot be above the highest.",
  "booking.pax_invalid": "Place counts can be set for 100 variants at most.",
  "booking.timezone_invalid": "The time zone is not valid (e.g. Europe/Istanbul).",
  "booking.price_adjustment_invalid":
    "A price difference is at most 1,000,000 TL with at most two decimals, for 100 variants at most.",
  "booking.use_booking_route":
    "This product is booked by date: choose a departure and the number of people on its page.",
  "booking.sales_closed": "Sales for this departure have closed.",
  "booking.max_units": "At most {{max}} places can be booked in one cart.",
  "booking.client_share":
    "No more places can be held from this connection now; at most {{max}} on this departure.",
  "booking.currency_unsupported":
    "This departure can only be booked in Turkish lira; change the cart's currency.",
  "booking.price_unavailable": "This option has no price in your cart's currency.",
  "booking.hold_expired": "The places held in your cart have expired; choose the date again.",
  "booking.hold_mismatch":
    "The places held no longer match your cart; choose the date and people again.",
  "booking.price_changed": "The price of a booking in your cart has changed; review your cart.",
  "booking.region_unknown": "The region was not found.",
  "booking.quantity_too_high": "At most 100 of one option can be booked.",
  "booking.too_many_free_units": "At most 2 free guests can come with each person taking a place.",
  "booking.order_edit_unavailable":
    "Dated products cannot be changed by an order edit; cancel the order if need be.",
  "booking.travelers_missing": "Enter the details of every traveler before paying.",
  "booking.travelers_invalid": "A traveler's details are missing or not valid; check the form.",
  "booking.traveler_unknown": "Traveler not found.",
  "booking.traveler_search_invalid": "The name, birth date or number is not valid; check them.",
  "booking.cancel_too_late":
    "The service day has come; this booking can no longer be cancelled. Contact the shop.",
  "booking.cancel_unavailable":
    "This product has no cancellation terms; contact the shop to cancel.",
  "booking.cancel_unpaid": "Cancel an unpaid order as a whole.",
  "booking.cancel_unknown": "No booking to cancel was found on this order.",
  "booking.use_booking_cancel":
    "A dated order is cancelled booking by booking; the refund follows the cancellation terms.",
  "booking.order_change_unsupported":
    "A dated product is not returned or exchanged; cancel the booking instead.",
  "booking.slot_cancelled": "This departure was cancelled; it cannot be opened again.",
  "booking.use_departure_cancel": 'Use "Cancel departure" to cancel it; its bookings are refunded.',
  "addons.required_must_be_free": "A paid add-on cannot be required.",
  "addons.not_addon_line": "This product has no add-ons.",
  "addons.unknown": "The product has no such add-on or option.",
  "addons.duplicate": "The same add-on is picked twice.",
  "addons.text_required": "Enter the text for this add-on.",
  "addons.text_too_long": "The text is longer than this add-on allows.",
  "addons.charset": "The text may hold only letters, digits and spaces.",
  "addons.text_link": "The text may not hold a link, a web address or an e-mail address.",
  "addons.required": "Pick the add-on this product requires.",
  "addons.max_quantity": "A line with this add-on cannot hold that many units.",
  "addons.line_locked":
    "A line with add-ons keeps its details; change the picks in the product's add-on fields.",
  "addons.unavailable":
    "An add-on of an item in the cart is no longer sold. Change the pick or remove it.",
  "integration_credentials.check_failed":
    "The provider gave an unexpected answer; nothing was saved. Try again in a while.",
  "integration_credentials.invalid": "The value is not valid.",
  "integration_credentials.key_missing":
    "The server has no encryption key for provider accounts; tell the platform team.",
  "integration_credentials.provider_unreachable":
    "The provider cannot be reached just now. Your working connection stays; save the new details in a while.",
  "integration_credentials.secret_invalid":
    "The value must be 8–128 characters without spaces; copy it from the provider's console.",
  "integration_credentials.secrets_required":
    "Enter every secret field; all are asked again when the account number changes or the stored ones cannot be read.",
  "integration_credentials.unknown_provider": "There is no such payment or integration provider.",
  "iyzico.not_configured": "The shop has not connected its iyzico account yet.",
  "iyzico.basket_total_mismatch":
    "The basket could not be sent to iyzico consistently; start the payment again.",
  "iyzico.signature_mismatch":
    "iyzico's answer could not be verified; the payment was not accepted.",
  "iyzico.test_mode_mismatch":
    "This payment was taken in iyzico's other mode (sandbox/live); the connected account cannot refund it.",
  "iyzico.refund_outcome_unknown":
    "iyzico's answer to a refund was lost; no further refund of this payment can be made. Check the payment's refunds in iyzico's panel and tell the platform team.",
  "iyzico.refund_exceeds_line":
    "iyzico refused the amount: it is more than what is left of the payment.",
  "iyzico.refund_not_supported":
    "This card's bank takes no refunds; pay the customer back another way.",
  "iyzico.refund_same_day":
    "iyzico makes no partial refund on the day of the payment; try again tomorrow, or refund it whole.",
  "shipping.additional_data_reserved": "This request cannot carry the platform's own fields.",
  "shipping.cod_single_parcel":
    "An order paid at the door ships with a carrier as one parcel: the courier collects the whole amount with one parcel.",
  "shipping.no_rate":
    "This parcel is past the shop's shipping price table; shipping cannot be priced.",
  "shipping.days_order": "The fewest days cannot be more than the most.",
  "shipping.rate_table_order": "The price table's desi limits must rise, with at most one decimal.",
  "shipping.setup_incomplete":
    "The shop has several warehouses and none is the default (or none at all); choose the default warehouse under Settings > Locations.",
  "shipping.manual_flat_only": "An option the shop ships itself can only have a flat price.",
  "shipping.amount_invalid": "Enter the amount with at most two decimals.",
  "returns.unknown": "Return request not found.",
  "returns.status_invalid": "The return request is not in a state for this.",
  "returns.items_invalid":
    "The chosen items do not match what can be returned: at most what was shipped and not yet returned of each.",
  "returns.withdrawal_excluded":
    "This product has no right of withdrawal (made to order, digital content delivered or a service performed); it can come back only as damaged, wrong or not as described.",
  "returns.refusal_not_sealed":
    "Only goods that cannot be returned for health or hygiene reasons once their protective seal is opened can be refused for coming back opened.",
  "returns.window_closed": "The return period for this order is over, or it has not shipped yet.",
  "returns.gift_card_used":
    "A card of this gift card line has been spent, so its right of withdrawal is gone.",
  "returns.gift_card_separate":
    "Gift card lines are asked for in a request of their own, and only as money back.",
  "returns.already_open": "This order already has an open return request.",
  "returns.exchange_variant_invalid":
    "An exchange needs another option of the same product that is for sale.",
  "returns.exchange_same_variant":
    "An exchange needs a different option; pick another size or colour.",
  "returns.exchange_out_of_stock": "The option asked for is out of stock.",
  "returns.exchange_price_changed":
    "The exchange's price difference changed; look at the new one and approve again.",
  "returns.exchange_difference_due":
    "The shopper owes a difference; collect it and tick it before approving.",
  "returns.exchange_no_shipping": "The order has no shipping option to send the exchange with.",
  "returns.exchange_awaiting_return":
    "The new item ships once the exchanged one reaches the warehouse; receive the return first.",
  "orders.edit_balance_open":
    "The order has a balance apart from this edit (an earlier refund or collection); its lines cannot be edited.",
  "orders.edit_reference_invalid": "The edit key is invalid; close the dialog and open it again.",
  "returns.exchange_incomplete":
    "An exchange is received only once every item asked has come back; talk to the shopper about the missing one.",
  "returns.exchange_discounted_price":
    "An item bought with a discount can be swapped only for an option at the same price; otherwise ask for a return and place a new order.",
  "returns.exchange_balance_open":
    "The order has a balance apart from the exchange; it cannot be approved.",
  "returns.use_return_requests":
    "Returns, exchanges and claims are handled from the return requests screen only.",
  "returns.carrier_refused": "The carrier did not open the return; try again shortly.",
  "returns.cancel_handed_over":
    "The customer has handed the parcel to the carrier; the request cannot be cancelled. Receive it once it arrives.",
  "returns.cancel_received":
    "Items of this request have been received; the request cannot be cancelled.",
  "returns.cancel_exchange_collected":
    "The customer paid a difference on this exchange; it cannot be cancelled here. Receive the item, or refund the difference by hand and ask the shop's admin.",
  "returns.refund_failed":
    'The items were received but the refund failed; use "Try the refund again".',
  "aras.customer_code_invalid": "The customer code may hold up to 20 letters and digits.",
  "aras.service_url_invalid":
    "The service address must be one of Aras Kargo's own https addresses (araskargo.com.tr).",
  "shipping.carrier_unknown": "This parcel's carrier is not known; it cannot be tracked.",
  "shipping.carrier_not_connected":
    "The shipping service is not connected. Connect the account under Settings > Shipping.",
  "shipping.no_offer":
    "No carrier offer came for this shipment. The chosen service may not carry this parcel.",
  "shipping.option_invalid": "The shipping option does not belong to this service.",
  "shipping.option_in_use":
    "Orders waiting to ship use this shipping option; they must be shipped first.",
  "shipping.use_ship_route":
    'Shipments with this service are opened with "Ship" on the order page.',
  "shipping.address_incomplete":
    "The delivery address is incomplete for shipping. Complete it on the order page.",
  "shipping.receiver_abroad":
    "The delivery address is outside Türkiye; a domestic carrier does not ship there. Correct the address or send the order as the shop's own parcel.",
  "shipping.receiver_name_missing":
    "The delivery address names no receiver, and neither the billing address nor the customer's account has a name. Add one to the delivery address on the order page.",
  "shipping.receiver_name_short":
    "Yurtiçi Kargo needs the receiver's name to be at least 5 characters with 4 letters. Complete it in the delivery address on the order page.",
  "shipping.receiver_address_missing":
    "The delivery address has no street address (neighbourhood, street, number). Complete it on the order page.",
  "shipping.receiver_address_short":
    "Yurtiçi Kargo needs at least 10 letters or digits in the street address. Add the neighbourhood, street and number on the order page.",
  "shipping.receiver_place_missing":
    "The delivery address has no province or district; the carrier routes the parcel by them. Complete it on the order page.",
  "shipping.receiver_phone_missing":
    "The delivery address has no phone a courier can dial (10 digits with the area code), and neither the billing address nor the customer's account has one. Add one on the order page.",
  "shipping.sender_address_incomplete":
    "The warehouse's address is incomplete for shipping and the Geliver account has no default sender address. Complete it under Settings > Locations.",
  "shipping.sender_location_missing":
    "The warehouse the parcel leaves from could not be told and the Geliver account has no default sender address. Choose the default warehouse under Settings > Locations, or add a sender address in Geliver's panel.",
  "shipping.sender_address_missing":
    "The warehouse has no street address (neighbourhood, street, number) and the Geliver account has no default sender address. Complete it under Settings > Locations.",
  "shipping.sender_place_missing":
    "The warehouse has no province or district in Türkiye and the Geliver account has no default sender address. Complete it under Settings > Locations.",
  "shipping.sender_postal_missing":
    "The warehouse has no postcode and none was found in the address data (no neighbourhood chosen); the Geliver account has no default sender address either. Add the postcode or the neighbourhood under Settings > Locations.",
  "shipping.sender_phone_missing":
    "Neither the warehouse nor the shop has a phone, and the Geliver account has no default sender address. Add the warehouse's under Settings > Locations or the shop's under Settings > Store.",
  "shipping.sender_contact_missing":
    "The shop has no contact email (Geliver needs one for the sender) and the Geliver account has no default sender address. Add it under Settings > Store, or add a sender address in Geliver's panel.",
  "shipping.fulfillment_invalid": "That shipment is not a valid one to print a label for.",
  "shipping.label_unavailable": "This shipment has no label.",
  "aras.merchant_invalid":
    "Aras Kargo did not accept this user name. Copy it again from the integration details Aras gave.",
  "aras.secret_invalid":
    "Aras Kargo did not accept this user name and password. Copy them again from Aras's integration document; test and live accounts differ.",
  "customers.unknown": "Customer not found.",
  "customer_groups.unknown": "Customer group not found.",
  "customers.email_is_login":
    "A member's e-mail is their sign-in address; only the customer can change it from their account.",
  "customers.email_taken": "A guest customer with this e-mail already exists.",
  "customers.phone_invalid": "The phone number is not valid; write it as 0532 123 45 67.",
  "customers.guest_only":
    "Only guest customers are added from the panel; the customer opens their own account.",
  "customers.note_too_long": "A note can be at most 2000 characters.",
  "abandoned_carts.unknown": "The cart was not found or became an order.",
  "abandoned_carts.no_email": "This cart has no e-mail address.",
  "abandoned_carts.wholesale": "This cart is a wholesaler's; wholesalers get no cart reminders.",
  "abandoned_carts.no_consent":
    "The customer has not consented to commercial e-mail; reminders go to those who did.",
  "abandoned_carts.suppressed": "Nothing is sent to this address (it is on the block list).",
  "abandoned_carts.reminded": "A reminder was already sent for this cart.",
  "abandoned_carts.reminded_lately": "This address got a cart reminder in the last week.",
  "abandoned_carts.no_storefront":
    "Enter the shop's domain in the SEO settings first, for the reminder's link.",
  "messages.unknown": "Message not found.",
  "messages.not_resendable": "This message cannot be sent again.",
  "messages.sent_recently": "This message was just sent; try again in 10 minutes.",
  "account.login_email_missing":
    "This sign-in has no e-mail address; the account could not be opened.",
  "messaging.consent_evidence_required":
    "Write how the consent was given, in at least 10 characters.",
  "carts.unknown": "The cart was not found or is already completed.",
  "customer_segments.rules_empty": "Choose at least one rule for the segment.",
  "wishlist.full": "Your saved list is full; remove a few products first.",
  "wishlist.product_unknown": "The product was not found.",
  "messaging.email_domain_refuses":
    "This e-mail address's domain takes no mail; check the address.",
  "cart_reminders.link_invalid":
    "This link is invalid, expired or already used. You can reach your cart from the shop.",
  "marketing_feeds.unknown": "Feed not found.",
  "maintenance.not_enabled":
    "Maintenance mode is off. This link can only be made while the shop is in maintenance.",
  "maintenance.bypass_unknown": "The maintenance link is not valid or has expired.",
  "maintenance.shop_closed":
    "The shop is closed for maintenance and is not taking orders or forms right now. Please try again a little later.",
  "consents.link_invalid":
    "This link is invalid, expired or already used. You can give your consent from your account or by subscribing again.",
  "stock_alerts.link_invalid":
    "This link is invalid, expired or already used. You can ask again from the product page.",
  "stock_alerts.not_tracked": "Stock alerts are not available for this product.",
  "stock_alerts.in_stock": "This product is in stock now; you can order it.",
  "stock_alerts.email_required": "Write your e-mail address so we can tell you.",
  "reviews.not_purchased": "You can review only products you have received.",
  "reviews.photo_unknown": "One of the photos was not found; add it again.",
  "reviews.photos_too_many": "A review takes at most 3 photos.",
  "reviews.photo_uploads_full":
    "You have uploaded too many photos that are not on a review yet; try again tomorrow.",
  "reviews.unknown": "The review was not found.",
  "reviews.reply_required": "The reply cannot be empty.",
  "reviews.reply_too_long": "A reply can be at most 1,000 characters.",
  "reviews.reply_invalid": "The reply has invisible control characters; type it again.",
  "reviews.reply_not_approved": "Only approved reviews can be replied to.",
  "reviews.reply_missing": "This review has no reply to remove.",
  "questions.unknown": "The question was not found.",
  "questions.answer_purchasers_only": "Only customers who received the product can answer.",
  "messaging.no_address": "The customer has no address or phone for this channel.",
  "messaging.suppression_unknown": "That address is not on the list.",
  "messaging.domains_unavailable":
    "A sender domain is verified only while e-mail goes through Resend (deployed shops).",
  "messaging.domain_exists": "A sender domain is already set; remove it first.",
  "messaging.domain_missing": "No sender domain has been added yet.",
  "messaging.domain_invalid": "Type the domain without https:// or a path, e.g. shop.example.com.",
  "messaging.local_part_invalid":
    "The part before @ may hold lower-case letters, digits, dots, dashes and underscores (up to 32).",
  "messaging.template_unknown": "There is no such message template.",
  // adr/0036 Ek 2026-11-10: the shop's words for its customer messages
  "messaging.template_not_editable": "This message's text cannot be changed.",
  "messaging.template_field_unknown": "This message has no such field.",
  "messaging.template_text_invalid":
    "The text has a character that cannot be used. The subject, preview line and title must be one line.",
  "messaging.template_text_too_long": "This field can be at most {{limit}} characters.",
  "messaging.template_token_unknown":
    "The text has details that are not known: {{tokens}}. Available in this message: {{available}}.",
  "messaging.template_token_missing":
    "This text must contain {{tokens}}; the customer reaches the link or code only through it.",
  "messaging.template_required":
    "This message is required by law or by the order itself; it cannot be turned off, only reworded.",
  "messaging.template_switched_elsewhere":
    "This message is turned on and off in Settings > Marketing > Abandoned carts.",
  "messaging.sms_too_long":
    "With each detail at its longest the text must not run past {{parts}} SMS; shorten it.",
  "messaging.recipient_invalid": "The address or phone number is not valid.",
  "messaging.email_off": "E-mail is not set up for this shop.",
  "messaging.smtp_missing": "Save your mail server's details first.",
  "messaging.smtp_test_address_missing": "A test e-mail needs your account's e-mail address.",
  "smtp.host_invalid":
    "Type the server as a domain name or an IP address, for example mail.shop.com.",
  "smtp.port_invalid": "A mail server's port is 25, 465, 587 or 2525.",
  "smtp.host_refused":
    "This server name leads to a local or internal address the shop cannot connect to. Type the server's public name (e.g. mail.shop.com); for a server on the same machine type localhost.",
  "smtp.plain_remote":
    "An unencrypted connection is only made to a server on the same machine. Choose SSL/TLS (465) or STARTTLS (587).",
  "smtp.from_email_invalid": "Type the sender as an e-mail address.",
  "smtp.username_invalid": "The user name must be one line.",
  "smtp.from_name_invalid": "The sender name must be one line.",
  "smtp.rate_invalid": "Sends per minute must be between 1 and 300.",
  "smtp.merchant_invalid":
    "No secure connection could be made to the server. Check the security choice (SSL/TLS for 465, STARTTLS for 587) and that the server name matches its certificate.",
  "smtp.secret_invalid":
    "The mail server did not accept this user name and password. Check them against the e-mail account in your server's panel.",
  "messaging.sms_off":
    "No SMS account is connected. Enter the Netgsm account under Settings > SMS.",
  "google.merchant_id_invalid": "The Merchant Center account number is digits only.",
  "google.merchant_invalid":
    "The connected Google account cannot reach this Merchant Center account. Check the number and your access to it.",
  "google.secret_invalid":
    "The Google connection no longer works; connect the Google account again.",
  "google.state_invalid": "The Google connection expired or was already used; connect again.",
  "google.no_refresh_token": "Google gave no lasting access; start the connection again.",
  "google.search_console_scope":
    "The Google account was connected without Search Console; connect it again for Search Console.",
  "google.gsc_site_invalid":
    "This Search Console property is not one the connected Google account can read.",
  "google.not_configured": "The Google connection is not set up for this shop yet.",
  "google.not_connected": "Connect the Google account first.",
  "google.reviews_scope":
    "The Google account was connected without Business Profile; connect it again for Google reviews.",
  "google.location_invalid":
    "This business location is not one the connected Google account manages; refresh the list.",
  "google.review_not_found": "This Google review is gone; it may have been removed on Google.",
  "google.hide_reason_required":
    "Choose a reason to take the review off the storefront: personal data, abuse or off topic.",
  "google.hide_reason_invalid":
    "A Google review can only be taken off for personal data, abuse or being off topic.",
  "google.hide_reason_unexpected": "A review put back on the storefront takes no reason.",
  "google.reply_required": "The reply cannot be empty.",
  "google.reply_too_long":
    "The reply is over Google's limit (4096 bytes; accented letters count as two). Shorten it a little.",
  "google.reply_invalid": "The reply holds invisible control characters; type it again.",
  "google.reply_missing": "This review has no reply to remove.",
  "google.reply_forbidden":
    "The connected Google account may not reply to this business's reviews; connect an account that owns or manages the profile.",
  "google.reply_unverified":
    "Google allows replies only on verified Business Profiles; verify the profile on Google.",
  "google.reply_refused": "Google did not accept this reply; review the text and try again.",
  "google.reply_unavailable":
    "Google did not take the reply just now; nothing changed. Try again shortly.",
  "reports.range_invalid":
    "The date range is not valid: it cannot start after it ends, lie in the future or run over 366 days.",
  "catalog_import.cost_invalid":
    "The cost must be between 0 and 10,000,000, with two decimals at most.",
  "webhook.event_scope":
    "This key cannot read the data of the chosen events: order and return events need order reading, the stock event needs catalog reading.",
  "webhook.events_required": "Pick at least one event for the subscription.",
  "webhook.limit": "At most 20 webhook subscriptions can be open; delete the unused ones.",
  "webhook.unknown": "No such webhook subscription.",
  "webhook.url_https": "The address must start with https.",
  "webhook.url_internal":
    "The address cannot point inside the shop's network or to a local server.",
  "webhook.url_invalid": "The address is not valid.",
  "webhook.url_port": "The address can use port 443 only.",
  "staff.no_role": "Your account has no role in this shop; ask the shop's owner.",
  "staff.unknown": "No such team member.",
  "staff.remove_self": "You cannot remove yourself from the team.",
  "staff.invite_member": "This address already has an account.",
  "staff.invite_pending": "This address has an open invitation; send it again.",
  "staff.invite_failed": "The invitation could not be made.",
  "staff.invite_unknown": "No such invitation.",
  "staff.invite_invalid":
    "The invitation link is not valid or has expired; ask the shop's owner for a new one.",
  "staff.invite_login": "The account must use the invited e-mail address.",
  "staff.email_invalid": "The e-mail address is not valid.",
  "staff.name_required": "First and last name are required.",
  "staff.mfa_required": "Set up two-step verification, or sign in again with your code, to go on.",
  "staff.reset_self": "Turn your own two-step verification off from Settings > Security.",
  "staff.reauth_required": "Prove it is you again for this change.",
  "staff.reauth_failed": "The code or password is not right.",
  "staff.mfa_code_used": "This code was used; enter the app's next code.",
  "staff.reauth_locked": "Too many tries; try again a little later.",
  "staff.forbidden": "Your role does not allow this.",
  "staff.last_owner":
    "The shop's last owner cannot give up the role; make someone else owner first.",
  "api_key.delete_active": "An active key cannot be deleted; revoke it first.",
  "staff.password_wrong": "Your current password is not right.",
  "staff.password_same": "The new password cannot be your current one.",
  "staff.email_same": "This is already your sign-in address.",
  "staff.email_unavailable": "This e-mail address cannot be used; try another.",
  "staff.email_change_invalid":
    "The confirmation link is not valid, has expired or was used; ask again from the panel.",
  "staff.job_title_invalid": "The job title holds characters it cannot.",
  "staff.name_invalid": "The first or last name holds characters it cannot.",
  "api_key.fields_not_allowed": "A key cannot pick fields; each route returns its own.",
  "api_key.scope_denied": "This key is not allowed to do this.",
  "api_key.scopes_required": "Pick at least one permission for the key.",
  "api_key.title_invalid": "The key's name is not valid.",
  "api_key.unknown": "No such API key.",
  "accounting.adapter_unavailable": "This accounting program cannot be picked here.",
  "einvoice.waive_not_allowed":
    "Only a gider pusulası can be recorded as not needed; a company's return invoice is always recorded.",
  "einvoice.not_return": "This record is not a return's document.",
  "einvoice.not_sale":
    "A return's document is not entered as a sale invoice; enter it as the return's document.",
  "einvoice.return_not_pending":
    "The return's document no longer waits: it was entered, or recorded as not needed.",
  "einvoice.return_number_invalid":
    "The document number is letters, digits, spaces, dots, slashes or dashes (40 at most).",
  "einvoice.series_mismatch":
    "The invoice number must start with the web sales series set in Settings > E-Fatura.",
  "einvoice.provider_unavailable": "This invoicing program cannot be picked here.",
  "einvoice.currency_unsupported": "Only orders in Turkish lira are invoiced.",
  "einvoice.no_lines": "The order has no lines to invoice.",
  "einvoice.buyer_name_missing": "The billing address has no buyer name.",
  "einvoice.address_missing": "The order has no billing address.",
  "einvoice.tax_office_missing": "The corporate buyer has no tax office.",
  "einvoice.carrier_identity_missing":
    "The carrier's registered name and tax id are not entered (Settings > E-invoice).",
  "einvoice.store_url_missing": "The shop has no storefront address.",
  // adr/0072: BirFatura's pull and write-back
  "einvoice.phone_missing":
    "The order has no mobile phone; BirFatura takes no order without one. Enter the invoice by hand.",
  "einvoice.number_missing":
    "BirFatura issued the invoice but sent no number. Enter the number and the PDF by hand.",
  "einvoice.pdf_download_failed":
    "The invoice number was recorded but BirFatura's PDF could not be downloaded. Upload the PDF by hand.",
  "einvoice.parasut_unavailable": "Paraşüt cannot be connected on this server yet.",
  "einvoice.parasut_not_connected": "No Paraşüt account is connected (Settings > E-invoice).",
  "einvoice.parasut_disconnected":
    "Paraşüt refused the connection; connect the account again (Settings > E-invoice).",
  "einvoice.parasut_refresh_unknown":
    "Paraşüt's answer to a token refresh was lost; if it keeps failing, connect the account again.",
  "einvoice.parasut_code_refused":
    "Paraşüt did not accept this code. Get a new code from Paraşüt's page and paste it.",
  "einvoice.parasut_company_refused": "This Paraşüt account cannot reach this company number.",
  "einvoice.parasut_company_invalid": "A company number has digits only.",
  "einvoice.parasut_code_invalid":
    "The code looks wrong; paste the whole code from Paraşüt's page.",
  "einvoice.rate_limited": "Too many requests went to Paraşüt; it is tried again shortly.",
  "einvoice.unknown": "Invoice not found.",
  "einvoice.not_external": "This invoice is not issued by the shop's own program.",
  "einvoice.waived": "No invoice is issued for this sale (gift cards alone, an advance).",
  "einvoice.pdf_present": "This invoice already has its PDF.",
  "einvoice.birfatura_not_selected":
    "A BirFatura connection token is made only while BirFatura is the invoicing program (Settings > E-Invoice).",
  "einvoice.cancelled": "This invoice was cancelled.",
  "einvoice.already_issued": "This invoice was issued under another number.",
  "einvoice.number_taken": "This invoice number belongs to another invoice.",
  "einvoice.not_issued": "Enter the invoice number first, then upload its PDF.",
  "einvoice.number_invalid": "An invoice number takes GİB's form (e.g. ABC2026000000123).",
  "einvoice.uuid_invalid": "The ETTN looks wrong.",
  "einvoice.issued_at_invalid": "The issue date cannot be in the future.",
  "einvoice.pdf_invalid": "Only a PDF file can be uploaded.",
  "einvoice.pdf_missing": "This invoice has no PDF.",
  "einvoice.not_failed": "Only a stopped invoice can be tried again.",
  "einvoice.retry_failed": "The invoice could not be tried again; try again from the invoice list.",
  "einvoice.not_pending": "An invoice's contents can be read only while it waits to be issued.",
  "einvoice.number_year": "The year in the invoice number must be the issue date's year.",
  "einvoice.company_changed":
    "The invoice was opened in another Paraşüt company; the connected company changed. Look at Paraşüt.",
  "accounting.sync_unknown": "No such transfer record.",
  "accounting.source_missing": "The record to send is no longer there.",
  "accounting.month_invalid": "The month is not valid: one that has begun, two years back at most.",
  "catalog.cost_invalid":
    "The cost must be between 0 and 10,000,000 TL, with two decimals at most.",
  "statements.day_invalid":
    "This day cannot be checked: yesterday at the latest, a year back at most.",
  "statements.account_missing":
    "This payment provider is not connected; connect the account first.",
  // adr/0071 §12: the AI core; a service's own words are never shown
  "ai.no_service": "No connected AI service can do this. Connect a service under Settings > AI.",
  "ai.service_unavailable":
    "The chosen service is not connected or cannot do this. Pick another service from the list.",
  "ai.own_keys_not_in_plan":
    "Your plan does not include using AI with your own service key (BYOK).",
  "ai.key_rejected": "The service did not accept the API key. Check the key under Settings > AI.",
  "ai.provider_balance":
    "Your account at the service has no balance or quota left. Check your account in the service's own dashboard.",
  "ai.provider_busy": "The service is too busy right now (rate limit). Try again in a moment.",
  "ai.provider_quota":
    "Your account's quota at the service does not cover this job. Free use may not include it; turn on billing at the service, or try with another service.",
  "ai.provider_unavailable":
    "The service cannot be reached right now. Try again, or try with another service.",
  "ai.timeout": "The service did not answer in time. Try again, or try with another service.",
  "ai.content_blocked":
    "The service refused to write a suggestion for this content (content filter).",
  "ai.suggestion_refused": "No suitable suggestion came out. Try again.",
  "ai.provider_response_invalid": "The service gave an unexpected answer. Try again.",
  "ai.input_unsupported": "This image's type or size does not suit this task.",
  "ai.daily_limit_reached": "Today's AI usage limit has been reached. Try again tomorrow.",
  "ai.credits_exhausted": "You are out of AI credits. Add credits to continue.",
  "ai.unknown_entity": "The record the suggestion was asked for was not found.",
  "ai.unknown_task": "There is no such AI task.",
  "ai.suggestion_not_open": "This suggestion is no longer waiting for a decision.",
  "ai.candidate_unknown": "This suggestion has no such candidate.",
  "ai.no_choices":
    "There is no category to suggest: the shop needs a category shown on the storefront that the product is not in yet.",
  "ai.choices_too_long":
    "The shop's list is too long for this suggestion; nothing was sent to the AI. Shorten long tag, category or attribute option names.",
  "ai.no_empty_attributes":
    "There is no empty attribute to fill: the product's saved template needs an attribute shown on the storefront that has no value yet.",
  "ai.faq_item_invalid":
    "A question or answer cannot be added as it is: a question is one line ending in a question mark (at most 120 characters), an answer at most 400 characters, with no link, markup, personal data, price or all-caps words.",
  "ai.faq_not_product_faq": "This suggestion is not a product FAQ draft.",
  "ai.faq_all_published": "Every selected question is already published on the product page.",
  "ai.faq_use_faq_route": "A FAQ draft is accepted by adding the selected questions.",
  // Aşama 9: reviews and questions
  "ai.reviews_off": "AI on reviews and questions is off. You can turn it on under Settings > AI.",
  "ai.feature_off": "This feature is off for the shop.",
  "ai.not_enough_reviews": "A summary needs at least 3 approved reviews of this product.",
  // Aşama 7: a scene the shop wrote
  "ai.scene_text_invalid":
    "A scene must be plain text: 200 characters at most (its name 40); no links, HTML or quotes.",
  "ai.scenes_full": "At most 12 scenes can be saved. Delete one to add another.",
  // adr/0074 §2: the shop's writing guidance
  "ai.guidance_too_long":
    "A writing guidance field is too long: audience 160 characters at most, the free note 1500, a task's note and each example 600, each word 40, a task's own instruction 3000.",
  "ai.guidance_words_full": "The preferred and avoided word lists take 20 items each at most.",
  "ai.guidance_examples_full": "A task takes at most 3 examples.",
  "ai.guidance_unknown_task":
    "Writing guidance can only be given for the tasks where AI writes text.",
  // adr/0074 §3: a task's own instruction
  "ai.guidance_craft_owner_only": "Only the store owner can change a task's instruction.",
  "ai.guidance_craft_base_unknown":
    "The default instruction has changed meanwhile. Reload the page and try again.",
  // adr/0074 §5 madde 7: the bulk SEO fill
  "ai.seo_fill_nothing":
    "No page has a missing or weak search text; those waiting for a decision are not asked again.",
  "ai.seo_fill_quota_short":
    "Not enough AI allowance left: this job needs {{needed}} operations, {{left}} are left. Try a narrower choice (title only or description only) or raise your allowance.",
  // adr/0071 §3: "Test the connection" refused the key of an AI service
  "deepseek.secret_invalid":
    "DeepSeek did not accept this API key. Copy it again from the API keys page of the DeepSeek platform.",
  "minimax.secret_invalid":
    "MiniMax did not accept this API key. Copy it again from the API keys page of the MiniMax platform.",
  "gemini.secret_invalid":
    "Gemini did not accept this API key. Copy it again from the API keys page of Google AI Studio.",
  "meta.pixel_id_invalid": "The pixel id is digits only.",
  "meta.test_event_code_invalid": "The test event code is letters and digits only.",
  "meta.merchant_invalid": "Meta does not know this pixel, or the token cannot reach it.",
  "meta.secret_invalid": "Meta did not accept this access token.",
  "google_analytics.measurement_id_invalid":
    "The measurement id starts with G-, such as G-ABC123XYZ.",
  "netgsm.iys_brand_code_invalid": "The İYS brand code is digits only.",
  "netgsm.msgheader_invalid":
    "The sender name must be 2–11 characters; type your approved Netgsm header exactly.",
  "netgsm.merchant_invalid":
    "Netgsm took the login, but this sender name is not on the account. Type the approved header from the Netgsm panel exactly.",
  "netgsm.secret_invalid":
    "Netgsm did not accept this user code and password, or API access is off. Check API access and the IP allow list under Settings > API in the Netgsm panel.",
  "yurtici.merchant_invalid":
    "Yurtiçi Kargo did not accept the cash on delivery account's user name and password. Copy them again from the document Yurtiçi gave for that account.",
  "yurtici.secret_invalid":
    "Yurtiçi Kargo did not accept this user name and password. Copy them again from Yurtiçi's web service document; test and live accounts differ.",
  "yurtici.cod_account_missing":
    "Shipping an order paid at the door with Yurtiçi Kargo needs the cash on delivery account. Enter it under Settings > Shipping > Yurtiçi Kargo.",
  "geliver.merchant_invalid":
    "Geliver did not accept this API token. Copy it again from the API tokens page of the Geliver panel.",
  "geliver.secret_invalid":
    "Geliver did not accept this API token. Copy it again from the API tokens page of the Geliver panel.",
  "iyzico.merchant_invalid":
    "iyzico does not know this API key. Make sure it belongs to the chosen environment: a sandbox key works only with the sandbox on, a live key only with it off.",
  "iyzico.secret_invalid":
    "iyzico did not accept the secret key. Copy it again from the same page as the API key.",
  "media.alt_invalid": "The alt text has characters that cannot be used.",
  "media.alt_markup": "The alt text cannot contain a link or HTML markup (< >).",
  "media.file_id_invalid": "The file id is not valid.",
  "media.file_unknown": "File not found.",
  "media.filename_invalid": "Write a file name of 1–200 characters, without special characters.",
  "media.files_not_removed":
    "The image's files could not be deleted just now; the image stays in the library. Try again shortly.",
  "media.import_address_refused":
    "An image cannot be fetched from this address. Enter a public https address.",
  "media.import_unreachable":
    "The image at this address could not be reached. Open the address in a browser and check that the image shows.",
  "media.in_use":
    "This image is in use and cannot be deleted. Remove it from where it is used first (listed in its detail).",
  "media.not_an_image": "This file is not an image.",
  "media.unknown": "Image not found.",
  "media.update_empty": "No field to change was sent.",
  "listing.id_required": "Say which listing is asked for.",
  "listing.search_query_invalid": "Type a word to search for (100 characters at most).",
  "listing.search_query_unexpected": "A search text is sent with a search only.",
  "orders.nothing_to_ship": "Nothing is left to ship in this order.",
  "legal.unknown": "There is no such kind of legal text.",
  "legal.not_published": "This text is not published yet.",
  "legal.draft_missing": "This text has no draft.",
  "legal.nothing_published":
    "This text has no published version to copy into the draft. You can start from the starter text.",
  "legal.token_invalid":
    "The text has unknown or broken tokens: {{tokens}}. Tokens are written like {mağaza_unvanı}, with the names in the list.",
  "legal.cookie_consent_missing": "Choose your cookie preferences first.",
  "legal.consent_missing":
    "Accept the distance sales contract and the pre-information form before paying.",
  "legal.version_changed":
    "The contract has been updated; please read the new text and accept it again.",
  "legal.nothing_to_accept": "The shop has no published contract to accept.",
  "legal.copy_unknown": "No such contract is kept with this order.",
  "catalog.restriction_disabled":
    "Turn on “Restricted products” in Settings > Features before marking a product or category adults only.",
  "catalog.category_unknown": "The category was not found.",
  "catalog.category_image_unknown":
    "The category's picture must be one of the shop's uploads; choose it from the media library.",
  "catalog.collection_unknown": "The collection was not found.",
  "catalog.collection_description_invalid":
    "The description is too long or holds characters that cannot be used.",
  "catalog.collection_image_unknown":
    "The collection's picture must be one of the shop's uploads; choose it from the media library.",
  "age.declaration_missing":
    "Your cart holds an adults-only product; declare your age before paying.",
  "age.under_limit": "These products are sold only to buyers over the age limit.",
  "age.birth_date_invalid": "Enter a valid date of birth.",
  "age.not_required": "This cart needs no declaration of age.",
  "platform_settings.invoice_series_invalid": "The series is 3 letters or digits (such as WEB).",
  "platform_settings.min_age_invalid": "The age limit must be a whole number from 18 to 25.",
  "privacy_requests.unknown": "The KVKK request was not found.",
  "privacy_requests.not_open":
    "This request was already answered, or this action is not for its kind.",
  "privacy_requests.received_in_future": "The request cannot have been received in the future.",
  "privacy_requests.orders_open":
    "The customer has an order neither delivered nor canceled; erase once it is done.",
  "privacy_requests.returns_open": "The customer has a return under way; erase once it is settled.",
  "privacy_requests.accounting_pending":
    "A sale of the customer's is not in the accounting program yet; erase once it is sent.",
  "privacy_requests.erase_to_complete":
    "An erasure request is answered only by erasing; use Reject to refuse it.",
  "privacy_requests.export_missing":
    "Prepare the file first; the request is answered once it is sent.",
  "audit_log.forget_too_recent":
    "The audit log's client details cannot be cleared on entries this recent.",
  "legal.title_invalid": "The title cannot contain invisible control characters.",
  "orders.unknown": "Order not found.",
  "paytr.merchant_id_invalid":
    "The merchant number is digits only; copy it from Destek & Kurulum > Entegrasyon Bilgileri in the PayTR panel.",
  "paytr.merchant_invalid":
    "PayTR does not know this merchant number, or the store is not active. Check it on the Entegrasyon Bilgileri page.",
  "paytr.secret_invalid":
    "PayTR did not accept the merchant key or salt. Copy both again from the Entegrasyon Bilgileri page.",
  "products.unknown": "Product not found.",
  "price_lists.unknown": "Price list not found.",
  "price_lists.no_currency": "The shop has no currency set.",
  "price_lists.rate": "The rate must be between 0 and 100 percent.",
  "wholesale.managed":
    "This group or price list belongs to wholesale; change it on the wholesale screens.",
  "wholesale.tier_exists": "A wholesale level or customer group with this name already exists.",
  "wholesale.tier_in_use":
    "Wholesalers are on this level; move them to another level or delete them first.",
  "wholesale.tier_unknown": "Wholesale level not found.",
  "wholesale.variant_unknown": "One of the products chosen no longer exists.",
  "wholesale.exists": "A wholesaler with this e-mail address already exists.",
  "wholesale.account_unknown": "Wholesaler not found.",
  "wholesale.account_not_active": "This wholesaler is not active.",
  "wholesale.account_not_inactive": "This wholesaler is not closed.",
  "wholesale.account_not_pending": "This wholesaler is not awaiting an invitation.",
  "wholesale.no_price_source": "Choose a level for the wholesaler or turn on their own prices.",
  "wholesale.own_prices_off": "This wholesaler has no prices of their own yet; turn them on first.",
  "wholesale.tax_pair": "Enter the tax office and the tax number together.",
  "wholesale.company_for_tax": "A company name is needed with tax details.",
  "wholesale.account_not_bound": "This wholesaler has no customer account yet.",
  "wholesale.unproven_signup":
    "An account was opened with this e-mail but its address was never confirmed. Taking it over changes its password and ends its open sessions.",
  "wholesale.password_required": "Type the password the wholesaler will sign in with.",
  "wholesale.login_in_use":
    "This e-mail address is a staff member's sign-in; use another address for the wholesaler.",
  "wholesale.login_not_made": "The wholesaler's sign-in could not be prepared. Try again shortly.",
  "wholesale.password_own_login":
    'This wholesaler signs in with an account they verified themselves; they renew their password with "Forgot password" on the storefront.',
  "wholesale.carts_not_repriced":
    "Some open carts could not be updated to retail prices; the wholesaler was not deleted. Try again shortly.",
  "wholesale.no_password_login":
    "This customer signs in another way (e.g. Google), not with an e-mail and password; no password can be set.",
  "wholesale.prices_changed":
    "The prices in your cart were updated. Check the new total and start the payment again.",
  "wholesale.payment_unavailable":
    "The payment for your cart cannot be started right now. Refresh your cart and try again shortly.",
  "wholesale.min_quantity":
    "A wholesale order needs at least {{min}} items; your cart has {{units}}.",
  "platform_settings.color_invalid": "The colour must be in #rrggbb form, e.g. #2f6feb.",
  "platform_settings.color_duplicate": "Each colour name can be listed once.",
  "platform_settings.color_contrast":
    "This colour does not read well with white text or on the page background (at least 3:1 contrast is needed). Choose a darker shade.",
  "platform_settings.date_invalid": "The date and time are not valid.",
  "platform_settings.email_duplicate": "The same e-mail address is listed twice.",
  "platform_settings.email_invalid": "Enter a valid email address.",
  "platform_settings.feature_unknown": "There is no such feature.",
  "platform_settings.host_invalid": "Enter the domain without https:// or a path, e.g. shop.com.",
  "platform_settings.invalid": "The value is not valid.",
  "platform_settings.mersis_invalid": "A MERSİS number is 16 digits.",
  "platform_settings.tax_number_invalid":
    "Enter a valid tax number (10 digits) or Turkish ID number (11 digits).",
  "platform_settings.kep_invalid": "Enter a valid KEP address, e.g. title@hs01.kep.tr.",
  "platform_settings.etbis_invalid": "An ETBİS registration number is letters, digits and dashes.",
  "platform_settings.withdrawal_days_invalid":
    "The withdrawal period must be a whole number of days between 14 and 365; the law asks for at least 14.",
  "platform_settings.return_shipping_shop_only":
    "A withdrawal's return shipping cannot be charged to the customer (Distance Contracts Regulation art. 12); the shop pays it.",
  "platform_settings.hours_invalid":
    "The opening hours are not valid: each range must close after it opens and not overlap another on the same day.",
  "platform_settings.phone_invalid": "Enter a valid Turkish phone number.",
  "platform_settings.robots_invalid":
    "robots.txt may only hold User-agent, Allow, Disallow, Sitemap, Crawl-delay lines and comments.",
  "platform_settings.section_invalid": "The settings section's values are not valid.",
  "platform_settings.token_unknown":
    "The text has a {…} detail that is not known. Available: {mağaza_adı}, {telefon}, {e_posta}, {adres}, {whatsapp}, {ücretsiz_kargo_eşiği}.",
  "platform_settings.text_invalid": "The text cannot contain invisible control characters.",
  "platform_settings.timezone_invalid": "Choose a valid time zone.",
  "platform_settings.unknown_section": "There is no such settings section.",
  "platform_settings.url_invalid": "The address must start with https:// or /.",
  "platform_settings.page_unknown":
    "The chosen page was not found. Choose one of your pages in Content.",
  "platform_settings.favicon_unknown":
    "The site icon must come from your media library. Upload the image there and choose it again.",
  "platform_settings.logo_unknown":
    "The logo must come from your media library. Upload the image there and choose it again.",
  "platform_settings.favicon_type":
    "The site icon must be a PNG. Save your icon as a PNG and upload it.",
  "platform_settings.favicon_too_large":
    "The site icon can be at most 1 MB. Choose a smaller PNG (512 × 512 pixels is enough).",
  "product_attributes.definition_locked":
    "An attribute products have values for cannot change its key or unit.",
  "product_attributes.definition_unknown": "The attribute does not belong to this template.",
  "product_attributes.handle_invalid":
    "The handle holds only lowercase letters, digits and hyphens.",
  "product_attributes.handle_taken": "Another template uses this handle.",
  "product_attributes.key_invalid":
    "The key starts with a lowercase letter and holds only lowercase letters, digits and underscores.",
  "product_attributes.key_reserved":
    "A filterable attribute's key is another URL parameter's name (marka, fiyat, sirala, sayfa, variant, q, utm_…); choose another key.",
  "product_attributes.key_taken": "A key can be used once per template.",
  "product_attributes.option_in_use": "An option products use cannot be removed.",
  "product_attributes.option_title_required":
    "Enter the product option's name for a variant attribute.",
  "product_attributes.option_unknown": "The value is not one of this attribute's options.",
  "product_attributes.option_value_invalid":
    "An option value holds only lowercase letters, digits, hyphens and underscores (e.g. stainless_steel).",
  "product_attributes.options_duplicate": "Option values cannot repeat.",
  "product_attributes.options_not_allowed": "This attribute type takes no options.",
  "product_attributes.options_required": "Add at least one option for a choice attribute.",
  "product_attributes.product_unknown": "Product not found.",
  "product_attributes.template_change_unconfirmed":
    "Changing the template deletes the product's current values; confirm and try again.",
  "product_attributes.template_in_use": "Products use this template; remove it from them first.",
  "product_attributes.text_invalid": "The text cannot contain invisible control characters.",
  "product_attributes.type_locked":
    "An attribute products have values for cannot change type or scope.",
  "product_attributes.private_shown":
    "An attribute hidden from shoppers cannot be a filter, a title's word or a product option.",
  "product_attributes.value_invalid": "The value is not valid for this attribute.",
  "product_attributes.values_exist": "Products have values for the attributes being removed.",
  "product_attributes.variant_only":
    "variesBy and the option name apply to variant attributes only.",
  "product_attributes.group_unknown": "An attribute names a group the template does not have.",
  "product_attributes.group_key_invalid":
    "A group's key is 1–40 lower-case letters, digits, dashes or underscores.",
  "product_attributes.groups_duplicate": "A group key can be used once per template.",
  "product_attributes.aliases_duplicate": "A field's other names cannot repeat.",
  "product_attributes.convert_text_only":
    "Only a product-level text attribute can be turned into a single choice.",
  "product_attributes.convert_unmapped":
    "Products hold the value “{{value}}”, which is mapped to no option; map it or mark it to be cleared.",
  "product_attributes.convert_mapping_duplicate": "A stored value can be mapped only once.",
  "product_attributes.convert_required": "A required attribute's value cannot be cleared.",
  "description_facts.template_unknown": "The chosen attribute template was not found.",
  "description_facts.no_template":
    "The product has no attribute template; pick one for such products in the preview.",
  "description_facts.none": "No facts to bring over were found in the description.",
  "description_facts.required_missing":
    "A required field of the template stays empty ({{fields}}); fill it on the product page and bring the facts over again.",
  "promotions.code_invalid": "A code is 3 to 40 letters, digits, dashes or underscores.",
  "promotions.too_many_codes": "A request may send at most 5 codes.",
  "promotions.unknown": "Promotion not found.",
  "promotions.codes_template":
    "Single-use codes can only be made from a standard promotion with a code.",
  "promotions.one_code": "A cart takes one discount code; remove the one you added first.",
  "promotions.wholesale_no_code": "Discount codes cannot be used on wholesale orders.",
  "seo.canonical_invalid":
    "The canonical address must be a path on this site, e.g. /urun/keten-gomlek.",
  "seo.entity_id_invalid": "The record ID is not valid.",
  "seo.entity_type_invalid": "The record type is not valid.",
  "seo.entity_type_unknown": "This page type has no SEO fields.",
  "seo.entity_unknown": "Page not found.",
  "seo.fix_not_applicable": "This fix cannot be applied to this page.",
  "seo.locale_invalid": "The language code is not valid.",
  "seo.not_found_unknown": "This entry is not in the 404 log.",
  "seo.og_image_unknown": "The share image must be one of the shop's uploaded files.",
  "seo.path_active": "A record uses this path; only old paths can be released.",
  "seo.path_invalid": "A URL may hold only segments of lowercase letters, digits and hyphens.",
  "seo.path_not_owned": "This URL belongs to another record.",
  "seo.path_reserved": "This URL is reserved for the store's own pages.",
  "seo.path_taken": "Another record already uses this URL.",
  "seo.path_unknown": "This path is not registered.",
  "seo.publish_gate_blocked":
    "The product is not ready for search yet: it misses something critical or scores under 50. Complete the SEO advisor's suggestions.",
  "seo.redirect_csv_header": 'The file\'s first row needs a "source" column at least.',
  "seo.redirect_duplicate_row": "The same source appears more than once in the file.",
  "seo.redirect_exists": "This source already has a redirect; edit that one.",
  "seo.redirect_loop": "This redirect makes a loop: the target ends up back at this path.",
  "seo.redirect_match_invalid": "The match must be exact, prefix or pattern.",
  "seo.redirect_pattern_invalid":
    "The pattern is not valid: use :name placeholders and a final *, with one fixed segment at least.",
  "seo.redirect_pattern_limit": "The pattern rule limit is reached; turn some into exact rules.",
  "seo.redirect_query_invalid": "The parameter names to keep are not valid.",
  "seo.redirect_self": "The target falls under the rule's own source.",
  "seo.redirect_source_invalid": "The source path is not valid.",
  "seo.redirect_source_live": "A live page uses this path; change that page's address first.",
  "seo.redirect_source_query": "The source cannot have query parameters; enter the path only.",
  "seo.redirect_source_reserved": "This path is kept for the shop's own pages or the system.",
  "seo.redirect_source_root": "The home page cannot be redirected.",
  "seo.redirect_source_wildcard":
    "The source has * or :name; choose the pattern match for a pattern rule.",
  "seo.redirect_status_invalid": "The status must be 301, 302, 307 or 410.",
  "seo.redirect_target_gone": "The target page is gone (410); choose another target.",
  "seo.redirect_target_invalid": "The target must be a path on this site, e.g. /urun/keten-gomlek.",
  "seo.redirect_target_placeholder": "The target's placeholders must be in the source too.",
  "seo.redirect_target_required": "Enter the target path.",
  "seo.redirect_unknown": "Redirect not found.",
  "seo.security_txt_unset": "No security contact is set yet.",
  "seo.sitemap_unknown": "Sitemap file not found.",
  "seo.template_invalid": "The template has a tag this field does not support, or broken braces.",
  "seo.text_invalid": "The text holds characters that cannot be used.",
  "seo.text_too_long": "The text is too long.",
  "seo.url_style_conflicts":
    "The URL style could not be changed: some pages fall on the same address or another record holds it. Run the check again.",
  "seo.url_style_job_required":
    'The URL style changes every page\'s address; use "Change URL style" in the SEO settings.',
  "stock.item_unknown": "Stock item not found.",
  "stock.location_has_returns":
    "Returns are on their way to this location; receive or cancel them first.",
  "stock.location_has_stock":
    "This location holds, reserves or awaits stock; move or clear it first.",
  "stock.location_is_default":
    "The default location cannot be deleted; make another one the default first.",
  "stock.location_unknown": "Location not found.",
  "stock.preorder_disabled": "Turn on selling past stock in Settings > Features first.",
  "stock.text_invalid": "The text has characters that cannot be used.",
  "tr_address.district_id_invalid": "The district is not valid.",
  "tr_address.district_not_in_province": "The selected district is not in this province.",
  "tr_address.district_requires_province": "Choose a province before the district.",
  "tr_address.invalid":
    "The address does not match Turkish address records; check the province, district, neighbourhood and postal code.",
  "tr_address.neighborhood_not_in_district": "The neighbourhood is not in this district.",
  "tr_address.neighborhood_requires_district": "Choose a district before the neighbourhood.",
  "storefront_layout.text_invalid": "The text is too long or holds disallowed characters.",
  "storefront_layout.token_unknown":
    "The text has a {…} detail that is not known. Available: {mağaza_adı}, {telefon}, {e_posta}, {adres}, {whatsapp}, {ücretsiz_kargo_eşiği}.",
  "storefront_layout.target_invalid": "The chosen record is not valid.",
  "storefront_layout.target_unknown":
    "A record one of the sections shows no longer exists; choose it again.",
  "storefront_layout.image_invalid": "The image must come from the shop's media library.",
  "storefront_layout.section_invalid":
    "The section was not recognised; reload the page and try again.",
  "storefront_layout.section_duplicate":
    "A section was added twice; the announcement bar, the scrolling strip and the newsletter can appear once each.",
  "storefront_layout.marquee_limit":
    "A page can show at most two scrolling strips; the one in the header counts on every page.",
  "storefront_layout.price_bands_limit":
    "The home page can show at most two price bands sections; hidden or scheduled ones count too.",
  "storefront_layout.price_bands_order":
    "Price bands must rise; only the last one may have no upper bound.",
  // adr/0070: the free rows footer ("Serbest düzen")
  "storefront_layout.footer_rows_limit": "The footer takes one to six rows.",
  "storefront_layout.footer_blocks_limit":
    "The footer has too many blocks: a column takes up to 6 and the footer up to 24; some block types can be added only once.",
  "storefront_layout.footer_columns_mismatch":
    "The row's columns do not match its layout; refresh the page and try again.",
  "storefront_layout.footer_block_invalid":
    "A footer block could not be saved; check its fields (a text block takes no headings, pictures or tables; app links must be App Store or Google Play addresses).",
  "storefront_layout.footer_newsletter_twice":
    "The footer cannot show two newsletter forms; remove or hide the newsletter block or the footer group's newsletter section.",
  // adr/0073: content pages' own sections
  "storefront_layout.page_invalid":
    "The page given sections was not recognised; only the pages under Content can be laid out. Reload the page and try again.",
  "storefront_layout.page_duplicate":
    "The same page's layout was sent twice; reload the page and try again.",
  "storefront_layout.pages_limit": "At most 50 pages can have a layout of their own.",
  "storefront_layout.page_sections_limit": "A page holds at least one and at most 12 sections.",
  "storefront_layout.too_large":
    "The design has grown too large to save; shorten some sections or long texts.",
  "storefront_layout.color_invalid": "The colour must be in #rrggbb form, e.g. #2f6feb.",
  "storefront_layout.color_duplicate": "Each colour name can be listed once.",
  "storefront_layout.schedule_invalid": "The section must end after it starts.",
  "storefront_layout.nothing_to_publish": "There is no draft to publish; make a change first.",
  "storefront_layout.nothing_to_preview": "Save the draft once before previewing it.",
  "storefront_layout.revision_unknown": "This revision is no longer kept.",
  "storefront_layout.preview_unknown": "The preview link is not valid or has expired.",
  // adr/0065: the theme editor's live preview session
  "storefront_layout.session_unknown": "The live preview session has ended; open the editor again.",
  "storefront_layout.session_needs_sign_in": "The live preview needs a signed-in panel session.",
  // adr/0063 §4: a ready-made look applied to the draft
  "storefront_preset.unknown": "This ready-made look was not found.",
  "storefront_preset.pack_not_applied":
    "This look's sector pack is not applied to the shop; apply the pack first.",
  "storefront_preset.invalid": "The ready-made look's files could not be read; contact support.",
  "storefront_preset.theme_invalid": "The look's theme settings cannot be used in this shop.",
  "storefront_preset.layout_invalid": "The look's page design cannot be used in this shop.",
  "storefront_preset.demo_unavailable": "Demo content is not offered with this look yet.",
  // adr/0064: saved looks
  "storefront_design.unknown": "This saved look was not found.",
  "storefront_design.limit_reached": "You can save up to 10 looks. Delete one to save another.",
  "storefront_design.name_taken": "A saved look already has this name.",
  "storefront_design.name_invalid": "The name must be 1–60 characters with no unusable characters.",
  "storefront_design.unreadable": "This saved look can no longer be opened.",
  "storefront_design.too_large": "The look is too large to save.",
  "storefront_menus.text_invalid":
    "Menu and link names must be at most 60 characters, without disallowed characters.",
  "storefront_menus.target_invalid": "The link's target is not valid.",
  "storefront_menus.target_unknown":
    "A record one of the links points at no longer exists; choose the link again.",
  "storefront_menus.url_invalid": "The address must start with https:// or /.",
  "storefront_menus.too_many": "A menu can have at most 200 links.",
  "storefront_menus.no_children": "Only the main menu can have child links.",
  "storefront_menus.location_taken":
    "There is already a menu in this place; there is one main menu and one row of top links.",
  "storefront_menus.too_many_footers": "The footer can have at most 10 columns.",
  "storefront_menus.unknown": "Menu not found.",
  "tr_address.phone_invalid": "The phone number is not valid.",
  "tr_address.postal_code_invalid": "The postal code is not valid.",
  "tr_address.postal_code_neighborhood_mismatch": "The postal code is not the neighbourhood's.",
  "tr_address.postal_code_province_mismatch": "The postal code is not in the chosen province.",
  "tr_address.province_code_invalid": "The province is not valid.",
  "tr_address.province_not_found": "Province not found.",
  "tr_address.source_unavailable":
    "TürkiyeAPI could not be reached; the address data is unchanged. Try again shortly.",
  "tr_address.dataset_incomplete":
    "TürkiyeAPI sent incomplete data; the address data is unchanged. Try again shortly.",
  "tr_address.dataset_changed":
    "TürkiyeAPI's data changed during the download; the address data is unchanged. Try again.",
  "tr_address.file_required": "Name the file to import.",
  "upload.file_too_large": "The file is too big; upload 10 MB at most.",
  "upload.sheet_empty": "The file has no header row.",
  "upload.sheet_invalid": "The file could not be read; save it as Excel (xlsx) or CSV.",
  "upload.sheet_too_large": "The file's content is too big or broken.",
  "upload.sheet_too_many_rows": "The file has too many rows; upload 5,000 at most.",
  "upload.sheet_too_wide": "The file has too many columns.",
  "upload.csv_empty": "The file is empty.",
  "upload.csv_invalid": "The file could not be read: a quote is not closed.",
  "upload.csv_too_many_rows": "The file has too many rows; upload 1000 at most.",
  "upload.csv_too_wide": "The file has too many columns.",
  "upload.dimensions_too_large": "The image has too many pixels; upload a smaller one.",
  "upload.too_large": "The file is too large.",
  "upload.too_many_files": "Too many files were uploaded at once.",
  "upload.unreadable_image": "The image could not be read; the file may be damaged.",
  "upload.unsupported_type":
    "This file type is not supported; upload a JPEG, PNG, WebP or AVIF image.",
  "upload.svg_invalid":
    "The SVG file could not be read, or no SVG image was left once it was cleaned. Save it again as a plain SVG from your design program.",
  "upload.svg_too_large": "An SVG file can be at most 200 KB. Simplify it and try again.",
  "upload.svg_too_complex":
    "The SVG file has too many or too deeply nested elements. Simplify it and try again.",
  "upload.svg_too_many": "At most 3 SVG files can be uploaded at once.",
  "upload.svg_busy": "SVG files are being processed now. Try again in a few seconds.",
  // adr/0069: product videos
  "video.too_large": "A video can be 50 MB at most.",
  "video.too_long": "A video can be 30 seconds long at most.",
  "video.unsupported_type": "This file type cannot be uploaded. Upload MP4, MOV or WebM.",
  "video.dimensions_too_large": "The video's resolution is too high (4K at most).",
  "video.frame_rate_too_high": "The video's frame rate is too high (120 frames a second at most).",
  "video.unreadable": "The video could not be read; the file may be damaged.",
  "video.limit_per_product": "A product can have 2 videos at most.",
  "video.processing_failed":
    "The video could not be prepared. Try again; if it fails again, upload another file.",
  "video.youtube_invalid": "Enter a valid YouTube link.",
  "video.youtube_unavailable": "This video cannot be embedded or is not public.",
  "video.youtube_unreachable": "YouTube cannot be reached right now. Try again in a few minutes.",
  "video.upload_unavailable": "Videos cannot be uploaded right now.",
  "video.upload_busy": "Other videos are being uploaded now. Try again in a few seconds.",
  "video.file_required": "Choose a video file to upload.",
  "video.upload_timeout": "The video upload took too long. Check your connection and try again.",
  "video.title_invalid": "A video's title can be 200 characters at most, on one line.",
  "video.unknown": "Video not found.",
  "video.retry_unavailable": "This video cannot be tried again.",
  "video.source_gone":
    "The video's uploaded file is no longer kept. Remove the video and upload it again.",
  "media.svg_logo_only":
    "SVG can be used only as the shop's logo and site icon. Choose a PNG, JPEG, WebP or AVIF image for this field.",
  "cart.completed": "An order was already placed with this cart.",
  "cart.email_required": "An email address is needed to place the order.",
  "cart.empty": "The cart is empty.",
  "cart.phone_required": "The shipping address needs a phone number for the payment.",
  "cart.shipping_method_required": "Choose a shipping option.",
  "cart.unknown": "Cart not found.",
  "payments.cart_changed": "The cart changed; start the payment again.",
  "payments.refunding":
    "Your payment was received but the order could not be placed; it is being refunded to your card.",
  "payments.amount_due": "There is an amount to pay for this cart; choose a way to pay.",
  "payments.checkout_invalid": "The payment details are missing or invalid.",
  "payments.restart_checkout": "The amount changed; start the payment again.",
  "payments.return_url_invalid": "The return address is not one of this shop's addresses.",
  "payments.session_invalid": "The payment session is not recognised.",
  "payments.use_checkout_route": "This payment method starts from the shop's checkout step.",
  "paytr.not_configured": "The shop has not connected its PayTR account yet.",
  "orders.test_payment_not_shippable":
    "This order was paid in test mode, no real money was taken: it ships only with a carrier in test mode (Aras, Yurtiçi, Geliver). Its shipping option is your own delivery or a carrier in live mode.",
  "paytr.refund_locked":
    "PayTR is not taking a refund of this payment right now (a payout is running); try again later.",
  "paytr.refund_exceeds_payment": "The refund is more than what is left of the payment.",
  "paytr.payment_not_notified":
    "PayTR does not see this payment's notification acknowledged; it cannot be refunded.",
  "paytr.refund_not_supported": "PayTR does not take a refund for this payment.",
  "paytr.balance_insufficient": "Your PayTR balance is not enough for this refund.",
  "paytr.payment_too_old": "The payment is past its refund period.",
  "paytr.payment_not_found": "PayTR could not find this payment.",
  "paytr.test_mode_mismatch":
    "The payment's test mode does not match your account's; test keys never refund a real payment.",
  "payments.refund_reference_missing": "The refund reference is missing; start the refund again.",
  "orders.refund_line_unknown": "This line is not on the order.",
  "orders.refund_units_exceeded": "More units were chosen than this line can still give back.",
  "orders.refund_exceeds_paid": "The refund is more than the order can still give back.",
  "orders.refund_empty": "There is nothing to refund.",
  "orders.refund_reference_taken":
    "This refund key was used on another order or another payment; start the refund again.",
  "orders.refund_mode": "Choose lines and shipping, or enter an amount.",
  "orders.refund_amount_kurus": "The amount takes at most two decimals.",
  "orders.refund_reference_invalid": "The refund key is not valid; start the refund again.",
  "orders.refund_note_reserved":
    "This note is kept for the system's own refund records; change it.",
  "orders.refund_not_open": "This refund is no longer open; reload the page.",
  "orders.refund_unknown": "This refund is not on the order.",
  "orders.refund_unsettled":
    "The record of a refund of this order is incomplete; no money was sent again. It is checked automatically. If you would rather not wait, check the provider's panel and settle the record from the Refunds tab of the order page.",
  "orders.refund_check_partial":
    'Only part of this refund was made, not all of it; "money went back" or "money did not go back" cannot be chosen. Record the part made; the rest can be given back with a new refund.',
  "orders.refund_check_part_unknown":
    "iyzico did not answer for a part of this refund; that part may have been made. Check iyzico's panel or write to its support team before closing it in part.",
  "orders.refund_in_part_flow_owned":
    "This refund belongs to the order's cancel or a return request; it cannot be closed in part here. Run the cancel or the return again and only the rest is sent. If iyzico will not take the rest, refund it by hand in iyzico's panel and say so here.",
  "orders.refund_lost_part_required":
    "iyzico did not answer for a part of this refund. First choose whether iyzico's panel shows that part refunded.",
  "orders.refund_lost_part_none":
    "No part of this refund is left without an answer; reload the page and try again.",
  "orders.refund_settle_mode":
    "Choose either the refund's outcome or the state of the part without an answer.",
  "orders.refund_check_not_partial":
    "This refund does not look made in part; settle it with the other choices.",
  "orders.refund_check_shown":
    'The provider shows this refund made; "money did not go back" cannot be chosen.',
  "payments.use_order_refund": "This payment is refunded from the order's refund step.",
  "payments.max_installment_invalid": "The most installments is 2 to 12 (0: what PayTR allows).",
  "payments.installments_unknown": "No product or cart found for the installment table.",
  "payments.installments_target": "Give a cart, or a product and a region, for installments.",
  // F14 (adr/0042): moving a shop from its old platform
  "migration.bundle_invalid":
    "The migration file could not be read or is not in the format; the field is named.",
  "migration.email_invalid": "The e-mail address is not valid; the customer was not moved.",
  "migration.product_not_written": "The product could not be written; see the Products sheet.",
  "migration.product_description_failed":
    "The product's formatted description could not be written; it kept its plain text description.",
  "migration.product_gone":
    "The product an earlier run made is gone; its description was not refreshed.",
  "migration.description_refresh_empty":
    "The export has no description for this product; its description here was left as it is.",
  "migration.refresh_wordpress_only": "Descriptions are refreshed from a WordPress export only.",
  "migration.review_product_missing":
    "The review's product did not move, so the review did not either.",
  "migration.review_duplicate":
    "This customer already reviewed this product; the second review did not move.",
  "migration.parcel_incomplete":
    "The default parcel takes its weight, length, width and height together.",
  "migration.product_parcel_defaulted":
    "The source had no measurements; the default parcel was used.",
  "migration.product_no_parcel":
    "No weight or measurements; shipping is priced by the default parcel.",
  "migration.run_not_interrupted": "Only a run that stopped half-way can be started again.",
  "migration.run_unknown": "No such migration run.",
  "migration.source_file_gone":
    "This run's file is no longer kept; upload the file again and start.",
  "migration.shopify_not_connected":
    "No Shopify store is connected; connect it under Settings > Integrations first.",
  "migration.shopify_currency":
    "The Shopify store sells in a currency other than lira; prices are never converted.",
  "shopify.shop_domain_invalid": "The store address takes the form your-store.myshopify.com.",
  "shopify.client_id_invalid": "The client ID is not valid.",
  "migration.image_address_refused":
    "The picture's address was refused: it leads inside the network or somewhere not allowed.",
  "migration.image_too_large": "The picture is over 10 MB; it did not move.",
  "migration.image_unreachable":
    "The picture could not be reached; it did not move. You can add it by hand.",
  "migration.image_unreachable_not_found":
    "The old site does not have the picture (404); it did not move. You can add it by hand.",
  "migration.image_unreachable_forbidden":
    "The old site refused the picture (401/403); it did not move. Run the migration again or add it by hand.",
  "migration.image_unreachable_throttled":
    "The old site turned requests away as too many (429); after several tries it did not move. Run the migration again.",
  "migration.image_unreachable_server":
    "The old site's server failed (5xx); after several tries it did not move. Run the migration again.",
  "migration.image_unreachable_timeout":
    "The old site did not answer in time; after several tries it did not move. Run the migration again.",
  "migration.image_unreachable_network":
    "The old site could not be reached; after several tries it did not move. Run the migration again.",
  "migration.image_unreachable_deferred":
    "The pictures' time ran out; this one was not tried. Run the migration again to fetch the rest.",
  "migration.image_unreachable_status":
    "The old site answered with something other than the picture; it did not move. You can add it by hand.",
  "migration.image_not_accepted": "Not an accepted picture (JPEG, PNG, WebP, AVIF), or unreadable.",
  "migration.url_path_taken":
    "This old address belongs to another record here; it was not redirected.",
  "migration.url_rules_refused":
    "The redirect rules could not be written; review the decisions and apply again.",
  "migration.url_target_not_live": "The target must be a live page here (not another redirect).",
  "migration.sitemap_invalid":
    "The sitemap could not be read; it must be sitemaps.org XML (or .xml.gz).",
  "migration.sitemap_unreachable":
    "The sitemap could not be reached; open its address in a browser and try again.",
  "migration.sitemap_address_refused":
    "This address cannot be fetched: it leads inside the network or somewhere not allowed.",
  "migration.search_console_invalid":
    "The Search Console file could not be read; upload the zip from Performance > Export > CSV, or its pages CSV.",
  "migration.feed_invalid":
    "The product feed could not be read; it must be Google Merchant XML (RSS 2.0, g: attributes).",
  "migration.feed_unreachable":
    "The product feed could not be reached; open its address in a browser and try again.",
  "migration.feed_address_refused":
    "This address cannot be fetched: it leads inside the network or somewhere not allowed.",
  "migration.feed_currency":
    "The item is priced in a currency other than lira; prices are never converted.",
  "migration.feed_stock_untracked":
    "The feed gives no stock count: its variants not out of stock (in stock, preorder, backorder) moved without stock tracking, always sellable. Enter quantities in the panel to count them.",
  "migration.feed_item_invalid":
    "The item's title, address or price could not be read; it did not move.",
  "migration.customers_sheet_invalid":
    "The customer list could not be read; it must be xlsx or CSV with an e-mail column.",
  "migration.claim_invalid":
    "The invitation link is not valid or has expired; ask the shop for a new one.",
  "migration.claim_not_yours":
    "This invitation was sent to another address; sign in with the address it came to.",
  "migration.claim_used": "Your earlier account details were already taken with this invitation.",
  "migration.customer_erased":
    "This customer asked for their data to be erased; they were not moved again.",
  "migration.product_handle_taken":
    "Another product here holds this handle; the product did not move (nothing is written over). Change the handle at the source or remove the product here.",
  "migration.url_path_reserved":
    "This old address is the site's home page or a reserved path; it was not tied to a record.",
  "migration.wordpress_invalid":
    "The file is not a WordPress export or could not be read. Upload the .xml file from Tools > Export > All content in WordPress.",
  "migration.wordpress_too_large":
    "The WordPress export is larger than 50 MB (the limit applies to the XML inside a zip too); it cannot be moved this way yet. Get in touch with us to move it.",
  "migration.wordpress_trashed": "The record is in WordPress's trash; it was not moved.",
  "migration.wordpress_product_type":
    "A grouped or external product has no price of its own; it was not moved.",
  "migration.wordpress_product_unread":
    "The product's name or slug could not be read; it was not moved.",
  "migration.wordpress_attributes_unread":
    "The product's attributes could not be read; its options were taken from its variations.",
  "migration.wordpress_product_no_price":
    "The product (or every variation of it) has no price; it was not moved.",
  "migration.wordpress_options_too_many":
    "The product has more than three variation attributes; the first three became options.",
  "migration.wordpress_stock_shared":
    "The stock was the product's shared stock in WordPress; with no shared stock here, this variant took the product's count. Correct the variants' stock in the panel.",
  "migration.wordpress_variation_disabled":
    "The variation is disabled in WordPress; it was not moved.",
  "migration.wordpress_variation_no_price": "The variation has no price; it was not moved.",
  "migration.wordpress_variation_unread":
    "The variation's option values could not be read; it was not moved.",
  "migration.wordpress_variation_orphan":
    "The variation's product is not in the file; it was not moved.",
  "migration.wordpress_image_missing":
    "The picture is not in the file's media library; it was not moved. You can add it to the product.",
  "migration.wordpress_category_image_missing":
    "The category's picture is not in the file's media library; it was not moved. You can add it to the category.",
  "migration.category_cover_no_category":
    "The picture's category is not in this shop; the picture was not moved.",
  "migration.category_cover_refused":
    "The category's picture could not be saved; you can add it to the category.",
  "migration.wordpress_description_cut":
    "The product description is longer than a page may be; it was cut at a section.",
  "migration.wordpress_summary_cut":
    "The short description is longer than 1,500 characters; it was cut there. Shorten it on the product's page.",
  "migration.wordpress_body_cut": "The text is too long; it was cut at a section.",
  "migration.wordpress_body_media":
    "Pictures or widgets in the text (a product grid, a gallery) were not moved; the text was. Add pictures in the content editor.",
  "migration.wordpress_post_unread":
    "The post's title or slug could not be read; it was not moved.",
  "migration.wordpress_path_reserved":
    "This address is one of the storefront's own pages (/blog, /sepet, /magaza…); no content page was made, its old address awaits your decision under Old addresses.",
  "migration.wordpress_post_categories":
    "The post has several categories; its primary one became its category, the others did not move.",
  "migration.wordpress_post_tags_cut": "The post has more than 50 tags; the first 50 moved.",
  "migration.wordpress_term_unread":
    "The category or tag name could not be read (shortcode debris, or longer than 120 characters); it was not moved.",
  "migration.wordpress_page_front":
    "The front page; no content page was made. The storefront's home page is set in the Storefront settings.",
  "migration.wordpress_page_legal":
    "A legal text; no content page was made (legal texts are published from Settings > Legal). Redirect its old address to its /yasal/... page under Old addresses.",
  "migration.wordpress_page_system":
    "A shop system page (cart, checkout, account, wishlist); no content page was made.",
  "migration.wordpress_page_empty":
    "The page has no text of its own (theme widgets only); no content page was made.",
  "migration.wordpress_noindex_draft":
    "The old site kept it out of search engines (noindex); it moved as a draft: review it, then publish or delete it.",
  "migration.wordpress_comment_not_review":
    "The comment has no rating; it was not moved as a product review.",
  "migration.wordpress_review_photos":
    "The review's photos were not moved; its text and rating were.",
  "migration.wordpress_handle_duplicate":
    "Another record has the same slug; only the first one moved.",
  "migration.wordpress_menus":
    "Menus were not moved; set them up under Storefront > Menus (the ID column gives the item count).",
  "migration.wordpress_coupons":
    "Coupons were not moved; create them again as discount codes under Campaigns (their usage history is not in the export).",
  "migration.wordpress_blog_comments":
    "Blog comments were not moved (the storefront has no blog comments).",
  "migration.wordpress_product_tags":
    "Product tags were not moved (the storefront has no product tag pages; the old tag pages were noindex).",
  "migration.wordpress_attribute_not_moved":
    "A product attribute was not moved: once the attribute template has a field with this key it can be written to the products (the ID column gives the product and value counts).",
  "migration.description_facts_left":
    "This fact in the descriptions was not written to the products by itself (no field, more than one field, or a value that does not read); decide in Products > Bring over facts from the description (the ID column gives the product count).",
  "account.verification_session_required":
    "Sign in to your account first to confirm your address; the link works only in your session.",
  "account.session_invalid": "The session is not valid; sign in again.",
  "account.token_before_password_change":
    "The password changed, so this session ended; sign in again with the new password.",
  "auth.password_too_short": "The password must be at least 10 characters.",
  "auth.password_too_long": "The password can be at most 256 characters.",
  "auth.password_common":
    "This password is too common and easy to guess; choose another. A sentence of a few words works well.",
  "auth.password_contains_email": "The password must not contain your e-mail's name.",
  "auth.password_breached": "This password appears in a known data breach; choose another.",
  "fraud.challenge_required": "A security check is needed; the page does it itself, try again.",
  "fraud.refused": "This cannot be done now; please contact the shop.",
  "fraud.checkout_refused": "This order cannot be completed now; please contact the shop.",
  "fraud.velocity": "Too many tries; try again a little later.",
  "fraud.review_pending": "The order is under review; it cannot ship until approved.",
  "fraud.review_rejected": "The order was turned down in review; it cannot ship, cancel it.",
  "fraud.review_decided": "This review was just decided; refresh the page.",
  "fraud.block_invalid_email": "Enter a valid e-mail address.",
  "fraud.block_invalid_email_domain": "Enter a valid domain (e.g. example.com).",
  "fraud.block_invalid_phone": "Enter a valid Turkish phone number.",
  "fraud.block_invalid_ip": "Enter a valid IP address.",
  "campaigns.unknown": "Bulk message not found.",
  "campaigns.locked":
    "This message is scheduled or sending; its content cannot change. Copy it to make changes.",
  "campaigns.status_conflict": "The message's status just changed; refresh the page.",
  "campaigns.token_unknown":
    "The text has an unknown token. Only {ad} and the shop detail tokens can be used.",
  "campaigns.too_many_products": "An e-mail can have at most 4 product cards.",
  "campaigns.sms_too_long":
    "With the shop's name and the opt-out line, the text must fit in 3 SMS parts; shorten it.",
  "campaigns.content_missing": "Write the message's subject and text before sending it.",
  "campaigns.schedule_invalid": "The send time must be ahead and within 90 days.",
  "campaigns.channel_off": "E-mail sending is not on for this shop.",
  "campaigns.sender_unverified":
    "Bulk e-mail needs the shop's sender domain verified (Settings > E-mail).",
  "campaigns.sms_account_missing": "Connect the SMS account first (Integrations).",
  "campaigns.sms_opt_out_missing":
    "Enter the opt-out line first (Settings > SMS); every commercial text must carry it.",
  "campaigns.segment_unknown": "The chosen segment no longer exists; choose the audience again.",
  "campaigns.test_address_missing":
    "No address for the test: e-mail goes to your sign-in address, SMS to the shop's phone.",
  "campaigns.quota_spent": "Today's sending limit is used up; the test can go tomorrow.",
  "campaigns.audience_empty":
    "No one in this audience can receive the message (consent, suppression list or the 24-hour cap). Change the audience.",
  // adr/0051: payment links
  "payment_link.unavailable":
    "This payment link is not valid or has expired. Please contact the shop.",
  "payment_link.unknown": "Payment link not found.",
  "payment_link.prices_changed":
    "Prices in this order have changed. The shop has been told and will send you a new link.",
  "payment_link.out_of_stock":
    "An item in this order is out of stock. The shop has been told and will contact you.",
  "payment_link.no_storefront":
    "Set the shop's domain first (Settings > SEO) to make payment links.",
  "payment_link.no_region": "There is no Turkish lira region; a payment link cannot be made.",
  "payment_link.variant_unknown": "One of the chosen products was not found or is not published.",
  "payment_link.variant_unpriced": "One of the chosen products has no Turkish lira price.",
  "payment_link.customer_unknown": "The chosen customer was not found.",
  "payment_link.customer_required": "Choose a customer or enter the new customer's details.",
  "payment_link.customer_no_email": "The chosen customer has no e-mail address.",
  "payment_link.address_required": "With a shipping option, enter the delivery address too.",
  "payment_link.shipping_option_unknown": "The chosen shipping option was not found.",
  "payment_link.discount_not_allowed": "Your role cannot give a discount on a payment link.",
  "payment_link.discount_over_limit":
    "This discount is over your limit (20% at most). The shop owner can give more.",
  "payment_link.discount_invalid": "The discount is not valid; it cannot cover the whole order.",
  "payment_link.not_open": "This link is no longer open.",
  "payment_link.paying":
    "The customer is paying with this link right now. Try again in a few minutes.",
  "payment_link.extend_limit":
    "A link can stay valid for at most 7 days from its making; it cannot be extended further.",
  "payment_link.sent_recently": "This link was just sent; try again in 10 minutes.",
  "cart.payment_link_closed":
    "This cart's payment link has closed. A payment already taken is refunded automatically.",
  "cart.payment_link_superseded":
    "A newer cart was opened from this link; continue to pay from the latest one.",
  "cart.payment_link_changed":
    "The items of an order from a payment link cannot be changed. Open the link again.",
  "cart.payment_link_prices_changed":
    "Prices in this order have changed. The shop has been told and will send you a new link.",
  "cart.payment_link_code_misused": "This discount code works only in its own payment link's cart.",
  "cart.payment_link_locked":
    "The items and discount of an order from a payment link cannot be changed.",
  "cart.payment_link_no_cod": "Cash on delivery is not available for an order from a payment link.",
  "orders.use_payment_link": "Staff orders are made under Orders > Payment links.",
  // adr/0056: site search's synonym groups
  "search.synonym_terms_too_few":
    "A group needs at least two different terms. Letter case and Turkish letters do not make a term different.",
  "search.synonym_term_too_long": "A term can be at most 3 words.",
  "search.synonym_term_length": "A term can be at most 60 characters.",
  "search.synonym_terms_too_many": "A group can have at most 10 terms.",
  "search.synonyms_too_many":
    "The shop can keep at most 1,000 synonym groups; delete one to add another.",
  "search.synonym_unknown": "Synonym group not found.",
  "search.synonym_term_invalid":
    "Each term must contain a letter or a digit, with no hidden characters.",
  // adr/0007 Ek 2026-11-04: the KDV rates
  "vat.rate_unknown": "VAT rate not found.",
  "vat.rate_invalid": "Enter a rate between 0 and 100, with at most two decimals.",
  "vat.rate_exists": "A VAT rate in use already has this percentage.",
  "vat.rate_in_use":
    "Products are on this VAT rate. Move them to another rate first, then remove it.",
  "vat.rate_is_default": "The default rate cannot be removed. Make another rate the default first.",
  "vat.rate_inactive": "This VAT rate is removed. Bring it back first.",
  "vat.name_invalid": "Enter a name of at most 60 characters, without hidden characters.",
  "vat.name_taken": "Another VAT rate already has this name.",
  "vat.code_invalid": "The code takes letters, digits, _ and - only, at most 20.",
  "vat.code_taken": "Another VAT rate already has this code.",
  "vat.too_many": "A shop keeps at most 20 VAT rates in use. Remove one to add another.",
  // adr/0061 §5.3, Ek C14: the package's blocking limits
  "plan.limit_reached":
    "Your package's {{limit}} limit is reached ({{used}}/{{max}}). Settings > Subscription shows your package and usage.",
  // adr/0061 §5.5, Ek C15: the restricted and the suspended shop
  "plan.restricted":
    "Your shop is restricted because the subscription payment is overdue: this action is closed. Order operations, stock, KVKK requests, exports and your own account stay open. The owner and admins see the details in Settings > Subscription.",
  "plan.restricted_suspended":
    "Your shop is suspended by the platform: this action is closed. Order operations, stock, KVKK requests, exports and your own account stay open. The owner and admins see the details in Settings > Subscription.",
  "plan.suspended": "This shop is not taking orders right now. Please try again later.",
  "catalog_import.plan_limit":
    "Not added: your package's product limit is reached. Upload the file again once the limit allows more.",
  "migration.product_plan_limit":
    "Not moved: your package's product limit is reached. Run the move again once the limit allows more.",
  "migration.image_plan_limit":
    "Picture not taken: your package's storage limit is reached. The product moved without it; run the move again once there is room.",
}
