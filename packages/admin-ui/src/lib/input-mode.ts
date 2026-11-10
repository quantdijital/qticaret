/**
 * How the person is moving through the panel, on `<html data-input>`:
 * `keyboard` once they press Tab, `pointer` once they click or touch. The
 * focus outline shows in keyboard mode only (globals.css): a mouse user
 * never sees one, not even where a menu hands focus back to its button.
 */
export function trackInputMode(target: Document = document): void {
  const set = (mode: "keyboard" | "pointer") => {
    if (target.documentElement.dataset["input"] !== mode) {
      target.documentElement.dataset["input"] = mode
    }
  }
  target.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Tab") {
        set("keyboard")
      }
    },
    true
  )
  target.addEventListener(
    "pointerdown",
    () => {
      set("pointer")
    },
    true
  )
}
