import { briaImageEdit } from "./connectors/bria"
import { fakeImageConnector } from "./connectors/fake-image"
import { geminiImageEdit } from "./connectors/gemini-image"
import type { ImageEditConnector } from "./connectors/image-types"
import { photoroomImageEdit } from "./connectors/photoroom"
import { aiProviderError } from "./errors"
import { findAiService } from "./registry/services"
import type { AiService, FakeImageTarget, ImageEditTarget } from "./registry/services"
import { ownKeyTransport } from "./transport/own-key"
import type { AiTransport } from "./transport/types"

/**
 * The one way to an `image_edit` connector (adr/0071 §2, §9), as
 * `connector-of.ts` is for text: by a service's id, through the registry
 * of this instance, the key handed over here and kept in its closure; or
 * a transport (adr/0085 §3: the platform's).
 */

export interface ResolvedImageTarget {
  service: AiService
  target: ImageEditTarget | FakeImageTarget
}

export function imageTargetOf(
  serviceId: string,
  nodeEnv: string | undefined = process.env["NODE_ENV"]
): ResolvedImageTarget | null {
  const service = findAiService(serviceId, nodeEnv)
  const target = service?.capabilities.image_edit
  if (!service || !target) {
    return null
  }
  if (
    target.connector === "photoroom" ||
    target.connector === "gemini-image" ||
    target.connector === "bria" ||
    target.connector === "fake-image"
  ) {
    return { service, target }
  }
  return null
}

export function imageConnectorFor(
  serviceId: string,
  apiKey: string,
  nodeEnv: string | undefined = process.env["NODE_ENV"]
): ImageEditConnector {
  return imageConnectorWith(serviceId, ownKeyTransport(apiKey), nodeEnv)
}

/** The `image_edit` connector of a registered service, sending through a transport. */
export function imageConnectorWith(
  serviceId: string,
  transport: AiTransport,
  nodeEnv: string | undefined = process.env["NODE_ENV"]
): ImageEditConnector {
  const resolved = imageTargetOf(serviceId, nodeEnv)
  if (resolved === null) {
    throw aiProviderError({
      service: serviceId,
      key: "ai.service_unavailable",
      code: "not_registered",
    })
  }
  const { service, target } = resolved
  if (target.connector === "fake-image") {
    return fakeImageConnector
  }
  switch (target.connector) {
    case "photoroom":
      return photoroomImageEdit({ service, target, transport })
    case "bria":
      return briaImageEdit({ service, target, transport })
    case "gemini-image":
      return geminiImageEdit({ service, target, transport })
  }
}
