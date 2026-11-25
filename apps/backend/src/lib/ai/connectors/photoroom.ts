import { randomBytes } from "node:crypto"
import { aiProviderError } from "../errors"
import type { AiService, ImageEditTarget } from "../registry/services"
import { transportOf } from "../transport/own-key"
import type { ConnectorSending } from "../transport/own-key"
import type { AiTransport, AiTransportResponse } from "../transport/types"
import { postImageCall } from "./image-call"
import { IMAGE_TIMEOUT_MS } from "./image-types"
import type {
  ImageEditConnector,
  ImageEditRequest,
  ImageEditResult,
  ImageSceneRequest,
} from "./image-types"

/**
 * Photoroom's Remove Background API (Aşama 4; the record and its pages:
 * `lib/ai/registry/services.ts`). The picture goes as multipart
 * `image_file`; the key in `x-api-key` (the transport's) and nowhere else; a white
 * background as `bg_color`, a transparent one as a PNG with none. The
 * answer is the image itself, or JSON with it in `base64img`; never an
 * address.
 */

// A full size cut-out is at most 36 MP; as base64 JSON a third larger
const MAX_RESPONSE_BYTES = 40 * 1024 * 1024

const EXTENSIONS: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

export type PhotoroomOptions = {
  service: AiService
  target: ImageEditTarget
  timeoutMs?: number
  /** Tests only. */
  wait?: (ms: number, signal: AbortSignal) => Promise<void>
} & ConnectorSending

/** A multipart body of plain fields and one file. */
export function multipartBody(
  fields: Readonly<Record<string, string>>,
  file: { field: string; filename: string; mimeType: string; bytes: Buffer }
): { body: Buffer; contentType: string } {
  const boundary = `----qticaret${randomBytes(12).toString("hex")}`
  const parts: Buffer[] = []
  for (const [name, value] of Object.entries(fields)) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`
      )
    )
  }
  parts.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${file.field}"; filename="${file.filename}"\r\n` +
        `Content-Type: ${file.mimeType}\r\n\r\n`
    ),
    file.bytes,
    Buffer.from(`\r\n--${boundary}--\r\n`)
  )
  return { body: Buffer.concat(parts), contentType: `multipart/form-data; boundary=${boundary}` }
}

const contentTypeOf = (response: AiTransportResponse): string => {
  const header = response.headers["content-type"]
  return (header ?? "").split(";")[0]?.trim().toLowerCase() ?? ""
}

function readAnswer(service: AiService, response: AiTransportResponse): Buffer {
  const invalid = (code: string) =>
    aiProviderError({ service: service.id, key: "ai.provider_response_invalid", code })
  const type = contentTypeOf(response)
  if (type === "application/json") {
    let parsed: unknown
    try {
      parsed = JSON.parse(response.body.toString("utf8"))
    } catch {
      throw invalid("not_json")
    }
    const encoded = (parsed as { base64img?: unknown } | null)?.base64img
    if (typeof encoded !== "string" || encoded === "") {
      throw invalid("no_image")
    }
    // A data URL's head, when there is one, is not part of the bytes
    return Buffer.from(encoded.replace(/^data:[^,]{0,100},/, ""), "base64")
  }
  // Read as what its bytes are later (the upload check); only the kind of answer here
  if (type.startsWith("image/") && response.body.length > 0) {
    return response.body
  }
  throw invalid("not_an_image")
}

/**
 * A scene (Aşama 7): AI Backgrounds of the Image Editing API (`/v2/edit`;
 * the record: `lib/ai/registry/services.ts`). The subject is cut out and
 * kept as it is; only the setting is made from `background.prompt`, the
 * sector pack's description. `referenceBox=originalImage`: the product
 * stays where and as large as it was in the photo.
 */
function photoroomScene(options: PhotoroomOptions, transport: AiTransport, url: string) {
  const { service, target } = options
  return async (request: ImageSceneRequest): Promise<ImageEditResult> => {
    const extension = EXTENSIONS[request.image.mimeType]
    if (extension === undefined) {
      throw aiProviderError({
        service: service.id,
        key: "ai.input_unsupported",
        code: "image_type_unsupported",
      })
    }
    const { body, contentType } = multipartBody(
      { "background.prompt": request.setting, referenceBox: "originalImage" },
      {
        field: "imageFile",
        filename: `image.${extension}`,
        mimeType: request.image.mimeType,
        bytes: request.image.bytes,
      }
    )
    const response = await postImageCall({
      service,
      target,
      url,
      headers: {
        "Content-Type": contentType,
        Accept: "image/png, image/jpeg, application/json",
      },
      body,
      timeoutMs: options.timeoutMs ?? IMAGE_TIMEOUT_MS,
      maxResponseBytes: MAX_RESPONSE_BYTES,
      signal: request.signal,
      transport,
      wait: options.wait,
    })
    return { kind: "bytes", bytes: readAnswer(service, response), usage: {} }
  }
}

export function photoroomImageEdit(options: PhotoroomOptions): ImageEditConnector {
  const { service, target } = options
  const transport = transportOf(options)
  return {
    ...(target.scene ? { scene: photoroomScene(options, transport, target.scene.url) } : {}),
    async edit(request: ImageEditRequest): Promise<ImageEditResult> {
      if (!target.backgrounds.includes(request.background)) {
        throw aiProviderError({
          service: service.id,
          key: "ai.input_unsupported",
          code: "background_unsupported",
        })
      }
      const extension = EXTENSIONS[request.image.mimeType]
      if (extension === undefined) {
        throw aiProviderError({
          service: service.id,
          key: "ai.input_unsupported",
          code: "image_type_unsupported",
        })
      }
      const white = request.background === "white"
      const { body, contentType } = multipartBody(
        // White has no use for transparency; a cut-out keeps it
        white ? { format: "jpg", bg_color: "white" } : { format: "png" },
        {
          field: "image_file",
          filename: `image.${extension}`,
          mimeType: request.image.mimeType,
          bytes: request.image.bytes,
        }
      )
      const response = await postImageCall({
        service,
        target,
        url: target.url,
        headers: {
          "Content-Type": contentType,
          Accept: "image/png, image/jpeg, application/json",
        },
        body,
        timeoutMs: options.timeoutMs ?? IMAGE_TIMEOUT_MS,
        maxResponseBytes: MAX_RESPONSE_BYTES,
        signal: request.signal,
        transport,
        wait: options.wait,
      })
      return { kind: "bytes", bytes: readAnswer(service, response), usage: {} }
    },
  }
}
