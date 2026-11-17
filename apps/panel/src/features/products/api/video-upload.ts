import type { ProductVideo } from "./videos"

/**
 * A clip from this computer to its product (`POST /admin/products/:id/videos`,
 * multipart, up to 50 MB). Sent with `XMLHttpRequest` rather than the SDK's
 * `fetch`, whose request body reports no progress: `onProgress` hears the
 * share sent (0 to 1), or null while the size is unknown. Same origin, the
 * session cookie as the SDK sends it.
 */

export interface UploadFailure extends Error {
  status: number
  /** The backend's sentence (adr/0021), as `errorText` shows it. */
  message: string
  code?: string
}

function failure(status: number, body: unknown): UploadFailure {
  const { message, code } = (body ?? {}) as { message?: unknown; code?: unknown }
  const error = new Error(typeof message === "string" ? message : "") as UploadFailure
  error.status = status
  if (typeof code === "string") {
    error.code = code
  }
  return error
}

const parse = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

export function uploadProductVideo(
  productId: string,
  file: File,
  onProgress: (share: number | null) => void,
  signal?: AbortSignal
): Promise<ProductVideo> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open("POST", `/admin/products/${encodeURIComponent(productId)}/videos`)
    request.withCredentials = true
    request.responseType = "text"
    request.upload.onprogress = (event) => {
      onProgress(event.lengthComputable && event.total > 0 ? event.loaded / event.total : null)
    }
    request.onload = () => {
      const body = parse(request.responseText)
      const video = (body as { video?: ProductVideo } | null)?.video
      if (request.status >= 200 && request.status < 300 && video) {
        resolve(video)
      } else {
        reject(failure(request.status, body))
      }
    }
    // The network or the browser gave up: the generic line (`errorText`)
    request.onerror = () => {
      reject(failure(0, null))
    }
    request.onabort = () => {
      reject(failure(0, null))
    }
    signal?.addEventListener("abort", () => {
      request.abort()
    })
    const form = new FormData()
    form.append("file", file, file.name)
    onProgress(0)
    request.send(form)
  })
}
