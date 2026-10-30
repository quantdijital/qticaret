/**
 * The bulk queries a Shopify migration runs (API 2026-10; at most five
 * connections each, two levels deep). Every nested node asks for its `id`:
 * the file's lines are told apart by it (`gid://shopify/<Type>/<n>`).
 */

export const SHOP_QUERY = `{ shop { currencyCode } }`

export const COLLECTIONS_QUERY = `{
  collections { edges { node { id handle title descriptionHtml } } }
}`

export const PRODUCTS_QUERY = `{
  products { edges { node {
    id handle title descriptionHtml status vendor
    seo { title description }
    options { name values }
    media { edges { node { id ... on MediaImage { image { url } } } } }
    collections { edges { node { id title } } }
    variants { edges { node {
      id sku barcode price compareAtPrice inventoryQuantity
      selectedOptions { name value }
      inventoryItem { measurement { weight { unit value } } }
    } } }
  } } }
}`

export const CUSTOMERS_QUERY = `{
  customers { edges { node {
    id firstName lastName createdAt
    defaultEmailAddress { emailAddress marketingState marketingUpdatedAt }
    defaultPhoneNumber { phoneNumber smsMarketingConsent { state updatedAt } }
    addressesV2 { edges { node {
      id firstName lastName company address1 address2 city province zip phone countryCodeV2
    } } }
  } } }
}`

export const ORDERS_QUERY = `{
  orders { edges { node {
    id name createdAt currencyCode cancelledAt email
    displayFinancialStatus displayFulfillmentStatus
    totalPriceSet { shopMoney { amount } }
    customer { defaultEmailAddress { emailAddress } }
    lineItems { edges { node {
      id title sku quantity discountedTotalSet { shopMoney { amount } }
    } } }
  } } }
}`

export const PAGES_QUERY = `{
  pages { edges { node { id handle title } } }
}`

export const BLOGS_QUERY = `{
  blogs { edges { node { id handle title articles { edges { node { id handle title } } } } } }
}`
