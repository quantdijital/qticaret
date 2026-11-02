// The panel's own build-time settings (Vite exposes only `VITE_*`)
interface ImportMetaEnv {
  /** The storefront's origin for the theme editor's preview frame (adr/0049); a development default otherwise. */
  readonly VITE_STOREFRONT_ORIGIN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
