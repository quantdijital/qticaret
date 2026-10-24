/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend origin when the admin is served elsewhere; same origin otherwise. */
  readonly VITE_BACKEND_URL?: string
}
