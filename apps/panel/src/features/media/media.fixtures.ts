import type { MediaAsset, MediaDetail } from "@/features/media/api/media"

/** A library image as `/admin/media` lists it. */
export const asset = (id: string, more: Partial<MediaAsset> = {}): MediaAsset => ({
  id,
  url: `https://cdn.example.com/${id}.webp`,
  file_id: `${id}.webp`,
  filename: `${id}.webp`,
  mime_type: "image/webp",
  size: 245_760,
  width: 1200,
  height: 800,
  alt: null,
  created_at: "2026-11-03T09:30:00Z",
  ...more,
})

/** An image's detail: who uploaded it and where it is used. */
export const detail = (id: string, more: Partial<MediaDetail> = {}): MediaDetail => ({
  ...asset(id),
  uploaded_by: { id: "user_1", name: "Ayşe Yılmaz" },
  usage: [],
  ...more,
})
