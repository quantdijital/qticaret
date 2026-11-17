import type { ImageView, ProductVideoView } from "@qticaret/ui"

/**
 * One square of the gallery's rail: a photograph (its place among the
 * pictures shown, which the zoom steps through) or a video (adr/0069 §7).
 */
export type GallerySlide =
  { kind: "image"; image: ImageView; place: number } | { kind: "video"; video: ProductVideoView }

/**
 * The rail's squares: the pictures shown, in their order, each video after
 * as many of them as it says (`after`), in the order given; never before the
 * first photograph while there is one, and after the last when it says more
 * than there are (a variant's own set may be shorter). The pictures' own
 * places never move: the variants' picture places, the thumbnails' and the
 * zoom's count the pictures alone. Without videos: the pictures as they are.
 */
export function gallerySlides(
  images: readonly ImageView[],
  videos: readonly ProductVideoView[] = []
): GallerySlide[] {
  const slides: GallerySlide[] = images.map((image, place) => ({ kind: "image", image, place }))
  const least = images.length > 0 ? 1 : 0
  const placed = videos
    .map((video, order) => ({ video, order }))
    .sort((a, b) => a.video.after - b.video.after || a.order - b.order)
  for (const [inserted, { video }] of placed.entries()) {
    const after = Math.min(Math.max(Math.trunc(video.after), least), images.length)
    slides.splice(after + inserted, 0, { kind: "video", video })
  }
  return slides
}

/** The square a picture's place is shown in (the zoom closed on it); 0 when it is not there. */
export function slideOfPlace(slides: readonly GallerySlide[], place: number): number {
  const found = slides.findIndex((slide) => slide.kind === "image" && slide.place === place)
  return Math.max(found, 0)
}
