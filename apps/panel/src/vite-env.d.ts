// The panel's own build-time settings (Vite exposes only `VITE_*`)
interface ImportMetaEnv {
  /** The storefront's origin for the theme editor's preview frame (adr/0049); a development default otherwise. A production build without it keeps the live preview (adr/0065) off. */
  readonly VITE_STOREFRONT_ORIGIN?: string
  /** The theme editor's live preview (adr/0065); `false` falls back to a signed link per save. On by default. */
  readonly VITE_EDITOR_BRIDGE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
