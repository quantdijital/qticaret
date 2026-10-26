import { Node, ReactNodeViewRenderer, mergeAttributes } from "@tiptap/react"
import { CardView } from "./card-view"

export type CardKind = "product" | "category"

// A record id as the server takes it; a pasted card with anything else is not a card
export const CARD_ID = /^[a-z]+_[0-9A-Z]{26}$/

/** A short code for a record's card (adr/0019): only its id is kept; the storefront draws it live. */
function cardNode(kind: CardKind) {
  return Node.create({
    name: `${kind}Card`,
    group: "block",
    atom: true,
    draggable: true,
    selectable: true,
    addAttributes() {
      return { id: { default: null } }
    },
    parseHTML() {
      return [
        {
          tag: `aside[data-${kind}-id]`,
          getAttrs: (element) => {
            const id = element.getAttribute(`data-${kind}-id`) ?? ""
            return CARD_ID.test(id) ? { id } : false
          },
        },
      ]
    },
    renderHTML({ HTMLAttributes }) {
      const { id, ...rest } = HTMLAttributes as { id?: string }
      return ["aside", mergeAttributes(rest, { [`data-${kind}-id`]: id ?? "" })]
    },
    addNodeView() {
      return ReactNodeViewRenderer(CardView)
    },
  })
}

export const ProductCard = cardNode("product")
export const CategoryCard = cardNode("category")
