import type { FakeShopifyNode } from "./fake-server"

/** What the fake Shopify serves as files: a store's picture and the bulk files' lines. */

/** A real 64×48 PNG: what the fake serves at `/images/{name}` (a store's picture). */
export const FAKE_SHOPIFY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAEAAAAAwCAIAAAAuKetIAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAfUlEQVRoge2SAQkAURSDFsdMl9OAF2M8/sAAOhY/TpO6gQugvqK7EHdJ3cAFUF/RXYi7pG7gAqiv6C7EXVI3cAHUV3QX4i6pG7gA6iu6C3GX1A1cAPUV3YW4S+oGLoD6iu5C3CV1AxdAfUV3Ie6SuoELoL6iuxB3Sd3AxwN+3U6I0+Jnnj8AAAAASUVORK5CYII=",
  "base64"
)

/** The file Shopify writes: a line per node, children after their parent. */
export function jsonlOf(nodes: readonly FakeShopifyNode[]): string {
  const lines: string[] = []
  const write = (node: FakeShopifyNode, parent: string | null) => {
    const { children, ...fields } = node
    lines.push(JSON.stringify(parent ? { ...fields, __parentId: parent } : fields))
    for (const child of children ?? []) {
      write(child, node.id)
    }
  }
  for (const node of nodes) {
    write(node, null)
  }
  return lines.length > 0 ? `${lines.join("\n")}\n` : ""
}
