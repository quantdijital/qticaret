/**
 * The slug shape of the control plane panel's e2e shops (C11): the only
 * shops `e2e-shop` ever removes. Apart so lib/fleet/e2e-fleet.ts can use it
 * without importing the script (which imports it back).
 */
export const E2E_SHOP_SLUG = /^e2e-\d{13}-[0-9a-f]{6}$/
