import {
  createCustomerAddressesWorkflow,
  updateCustomerAddressesWorkflow,
} from "@medusajs/medusa/core-flows"
import { assertTrAddresses } from "../tr-address/assert-tr-addresses"

/**
 * Customer address workflows have no validate hook, so the check runs on the
 * saved addresses: throwing here fails the workflow and its compensation
 * undoes the write. Covers admin edits and other workflows, not only the
 * Store API middleware (F1.4).
 */
createCustomerAddressesWorkflow.hooks.addressesCreated(async ({ addresses }, { container }) => {
  await assertTrAddresses(
    container,
    addresses.map((address, index) => [`addresses.${String(index)}`, address])
  )
})

updateCustomerAddressesWorkflow.hooks.addressesUpdated(async ({ addresses }, { container }) => {
  await assertTrAddresses(
    container,
    addresses.map((address, index) => [`addresses.${String(index)}`, address])
  )
})
