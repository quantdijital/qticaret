import type { CartSnapshot } from "./cart-changes"
import { snapshotOf } from "./cart-changes"

/**
 * What the measuring keeps in the browser (D9), only while a tag is
 * allowed (nothing is written for a visitor who allowed none, and it is
 * forgotten when the answer is withdrawn): the once-only events already
 * sent (a purchase, per order) and the cart as last seen. Kept for the
 * whole browser, so another tab or a reload never counts them again;
 * storage refused, this page's memory counts them.
 */
const ONCE = "qt_event:"
const CART = "qt_cart_seen"

const remembered = new Set<string>()

function storage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** True the first time a key is asked in this browser (a purchase is counted once, whatever reloads it). */
export function firstTime(key: string): boolean {
  const name = `${ONCE}${key}`
  if (remembered.has(name)) {
    return false
  }
  remembered.add(name)
  try {
    const kept = storage()
    if (kept?.getItem(name)) {
      return false
    }
    kept?.setItem(name, "1")
  } catch {
    // Storage refused (full, private mode): this page remembers, the tags' own ids do the rest
  }
  return true
}

/** The cart as some tab of this browser last saw it. */
export function storedCart(): CartSnapshot | undefined {
  try {
    const raw = storage()?.getItem(CART)
    return raw ? snapshotOf(JSON.parse(raw)) : undefined
  } catch {
    return undefined
  }
}

export function storeCart(cart: CartSnapshot): void {
  try {
    if (cart.id === null) {
      storage()?.removeItem(CART)
    } else {
      storage()?.setItem(CART, JSON.stringify(cart))
    }
  } catch {
    // Storage refused: this page's own look still counts the next change
  }
}

/** Everything kept for the measuring, gone (the visitor withdrew it). */
export function forgetStored(): void {
  remembered.clear()
  try {
    const kept = storage()
    if (!kept) {
      return
    }
    const names: string[] = []
    for (let index = 0; index < kept.length; index += 1) {
      const name = kept.key(index)
      if (name && (name.startsWith(ONCE) || name === CART)) {
        names.push(name)
      }
    }
    for (const name of names) {
      kept.removeItem(name)
    }
  } catch {
    // Nothing kept to forget
  }
}
