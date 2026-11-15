"use client"

import dynamic from "next/dynamic"

/**
 * The theme editor's bridge, fetched on its own only where it is rendered
 * (adr/0065 §2): the live session's preview page. Never on the server, and
 * never part of a live page's code (`editor-bridge-scope.spec.ts`).
 */
const EditorBridge = dynamic(() => import("./editor-bridge").then((mod) => mod.EditorBridge), {
  ssr: false,
})

export function EditorBridgeLoader(props: {
  panelOrigin: string
  edition: string | null
  nonce: string | undefined
}) {
  return <EditorBridge {...props} />
}
