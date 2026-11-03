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
  "orders.cancel_after_packing":
    "An order packed or shipped cannot be cancelled; once it arrives, ask for a return.",
  "orders.cancel_contact_shop":
    "An order paid by bank transfer cannot be cancelled here; contact the shop to cancel it and get the money back.",
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
  "orders.ship_packed_first":
    "The packed parcel must go first; then the remaining lines can be chosen.",
  "orders.nothing_to_deliver": "No parcel of the shop's own delivery waits to be delivered.",
  "orders.deliver_failed": "The order could not be marked delivered; try again on its page.",
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
  "brands.logo_unknown": "The logo must be one of the shop's uploaded images.",
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
  "cart.shipping_changed":
    "The shipping price changed with your basket; choose shipping again and retry.",
  "cart.shipping_not_needed": "Nothing in the cart needs shipping; remove the shipping method.",
  "catalog_import.attribute_invalid":
    "The value does not fit this attribute (one of its options, a number or Yes/No).",
  "catalog_import.attribute_required": "A required attribute of the template is empty.",
  "catalog_import.attribute_unknown": "The product's template has no such attribute.",
  "catalog_import.brand_unknown": "No brand has this handle.",
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
  "catalog_import.stock_invalid": "Stock is zero or a positive whole number.",
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
  "catalog.dimensions_required":
    "A physical product needs weight and dimensions for every variant before it is published.",
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
  "catalog.variant_unknown": "The variant does not belong to this product.",
  "catalog.variants_too_many": "At most 500 variants can be saved at once.",
  "content.author_invalid":
    "The author name must be at most 120 characters, without disallowed characters.",
  "content.body_invalid":
    "The content holds an element or format that is not allowed; reload the page and try again.",
  "content.card_unknown":
    "One of the product or category cards in the content no longer exists; remove it.",
  "content.token_unknown":
    "The text has a {…} detail that is not known. Available: {mağaza_adı}, {telefon}, {e_posta}, {adres}, {whatsapp}, {ücretsiz_kargo_eşiği}.",
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
  "content.landing_not_original":
    "The text is not original enough (under 30%); it is too close to other filter pages. Make it specific to this page before publishing.",
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
  "errors.provider_unavailable": "The connected service cannot be reached; try again shortly.",
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
    "The shop has no default warehouse or shipping profile; choose a warehouse under Settings > Locations first.",
  "shipping.manual_flat_only": "An option the shop ships itself can only have a flat price.",
  "shipping.amount_invalid": "Enter the amount with at most two decimals.",
  "returns.unknown": "Return request not found.",
  "returns.status_invalid": "The return request is not in a state for this.",
  "returns.items_invalid":
    "The chosen items do not match what can be returned: at most what was shipped and not yet returned of each.",
  "returns.withdrawal_excluded":
    "This product has no right of withdrawal (hygiene or made to order); it can come back only as damaged, wrong or not as described.",
  "returns.window_closed": "The return period for this order is over, or it has not shipped yet.",
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
  "returns.refund_failed":
    'The items were received but the refund failed; use "Try the refund again".',
  "aras.customer_code_invalid": "The customer code may hold up to 20 letters and digits.",
  "aras.service_url_invalid":
    "The service address must be one of Aras Kargo's own https addresses (araskargo.com.tr).",
  "shipping.carrier_unknown": "This parcel's carrier is not known; it cannot be tracked.",
  "shipping.carrier_not_connected":
    "The shipping service is not connected. Connect the account under Settings > Shipping.",
  "shipping.dimensions_missing":
    "Some products in the cart have no weight or measures; shipping cannot be priced. Enter weight, length, width and height on their variants.",
  "shipping.no_offer":
    "No carrier offer came for this shipment. The chosen service may not carry this parcel.",
  "shipping.option_invalid": "The shipping option does not belong to this service.",
  "shipping.option_in_use":
    "Orders waiting to ship use this shipping option; they must be shipped first.",
  "shipping.use_ship_route":
    'Shipments with this service are opened with "Ship" on the order page.',
  "shipping.address_incomplete":
    "The delivery address is incomplete for shipping: province, district, postcode, address and phone are needed.",
  "shipping.sender_address_incomplete":
    "The warehouse's address is incomplete for shipping: province, district, postcode, address and phone are needed. Complete it under Settings > Locations.",
  "shipping.sender_contact_missing":
    "The shop has no contact email; the shipping service needs one for the sender. Add it under Settings > Store.",
  "shipping.location_unknown": "The warehouse the shipment leaves from was not found.",
  "shipping.fulfillment_invalid": "That shipment is not a valid one to print a label for.",
  "shipping.label_unavailable": "This shipment has no label.",
  "aras.merchant_invalid":
    "Aras Kargo did not accept this user name. Copy it again from the integration details Aras gave.",
  "aras.secret_invalid":
    "Aras Kargo did not accept this user name and password. Copy them again from Aras's integration document; test and live accounts differ.",
  "customers.unknown": "Customer not found.",
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
  "consents.link_invalid":
    "This link is invalid, expired or already used. You can give your consent from your account or by subscribing again.",
  "stock_alerts.link_invalid":
    "This link is invalid, expired or already used. You can ask again from the product page.",
  "stock_alerts.not_tracked": "Stock alerts are not available for this product.",
  "stock_alerts.in_stock": "This product is in stock now; you can order it.",
  "stock_alerts.email_required": "Write your e-mail address so we can tell you.",
  "reviews.not_purchased": "You can review only products you have received.",
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
  "messaging.recipient_invalid": "The address or phone number is not valid.",
  "messaging.email_off": "E-mail is not set up for this shop.",
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
  "content_drafts.no_provider": "No draft provider is set up yet.",
  "content_drafts.quota_reached": "This month's drafts are used up; they renew next month.",
  "content_drafts.not_open": "This draft is no longer waiting for approval.",
  "content_drafts.unknown_product": "Product not found.",
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
  "media.file_id_invalid": "The file id is not valid.",
  "media.file_unknown": "File not found.",
  "media.not_an_image": "This file is not an image.",
  "media.unknown": "Image not found.",
  "listing.id_required": "Say which listing is asked for.",
  "listing.search_query_invalid": "Type a word to search for (100 characters at most).",
  "listing.search_query_unexpected": "A search text is sent with a search only.",
  "orders.nothing_to_ship": "Nothing is left to ship in this order.",
  "legal.unknown": "There is no such kind of legal text.",
  "legal.not_published": "This text is not published yet.",
  "legal.draft_missing": "This text has no draft.",
  "legal.token_invalid":
    "The text has an unknown or broken token; tokens are written like {mağaza_unvanı}, with the names in the list.",
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
  "promotions.code_invalid": "A code is 3 to 40 letters, digits, dashes or underscores.",
  "promotions.too_many_codes": "A request may send at most 5 codes.",
  "promotions.unknown": "Promotion not found.",
  "promotions.codes_template":
    "Single-use codes can only be made from a standard promotion with a code.",
  "promotions.one_code": "A cart takes one discount code; remove the one you added first.",
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
    "A section was added twice; the announcement bar and the newsletter can appear once each.",
  "storefront_layout.schedule_invalid": "The section must end after it starts.",
  "storefront_layout.nothing_to_publish": "There is no draft to publish; make a change first.",
  "storefront_layout.nothing_to_preview": "Save the draft once before previewing it.",
  "storefront_layout.revision_unknown": "This revision is no longer kept.",
  "storefront_layout.preview_unknown": "The preview link is not valid or has expired.",
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
  "cart.completed": "An order was already placed with this cart.",
  "cart.email_required": "An email address is needed to place the order.",
  "cart.empty": "The cart is empty.",
  "cart.phone_required": "The shipping address needs a phone number for the payment.",
  "cart.shipping_method_required": "Choose a shipping option.",
  "cart.unknown": "Cart not found.",
  "payments.cart_changed": "The cart changed; start the payment again.",
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
    "This refund key was used on another order; start the refund again.",
  "orders.refund_mode": "Choose lines and shipping, or enter an amount.",
  "orders.refund_amount_kurus": "The amount takes at most two decimals.",
  "orders.refund_reference_invalid": "The refund key is not valid; start the refund again.",
  "payments.use_order_refund": "This payment is refunded from the order's refund step.",
  "payments.max_installment_invalid": "The most installments is 2 to 12 (0: what PayTR allows).",
  "payments.installments_unknown": "No product or cart found for the installment table.",
  "payments.installments_target": "Give a cart, or a product and a region, for installments.",
  // F14 (adr/0042): moving a shop from its old platform
  "migration.bundle_invalid":
    "The migration file could not be read or is not in the format; the field is named.",
  "migration.email_invalid": "The e-mail address is not valid; the customer was not moved.",
  "migration.product_not_written": "The product could not be written; see the Products sheet.",
  "migration.review_product_missing":
    "The review's product did not move, so the review did not either.",
  "migration.review_duplicate":
    "This customer already reviewed this product; the second review did not move.",
  "migration.parcel_incomplete":
    "The default parcel takes its weight, length, width and height together.",
  "migration.product_parcel_defaulted":
    "The source had no measurements; the default parcel was used.",
  "migration.product_drafted_no_parcel":
    "No weight or measurements; brought in as a draft. Add them and publish.",
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
  "migration.wordpress_variation_disabled":
    "The variation is disabled in WordPress; it was not moved.",
  "migration.wordpress_variation_no_price": "The variation has no price; it was not moved.",
  "migration.wordpress_variation_unread":
    "The variation's option values could not be read; it was not moved.",
  "migration.wordpress_variation_orphan":
    "The variation's product is not in the file; it was not moved.",
  "migration.wordpress_image_missing":
    "The picture is not in the file's media library; it was not moved. You can add it to the product.",
  "migration.wordpress_description_cut":
    "The product description is longer than 20,000 characters; it was cut at a paragraph.",
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
}
