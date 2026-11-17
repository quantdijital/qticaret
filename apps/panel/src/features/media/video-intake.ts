import { toast } from "sonner"
import { IMAGE_ACCEPT, SVG_ACCEPT } from "@/features/media/api/media"

/**
 * Video files a zone hands on instead of taking them into the library (a
 * product's gallery, adr/0069 §10): which files they are, where they go,
 * and why none is taken now (the product has its two).
 */
export interface VideoIntake {
  isVideo: (file: File) => boolean
  take: (files: File[]) => void
  /** The file input's types beside the pictures'. */
  accept: string
  /** The zone's line of types, videos named too. */
  types: string
  /** Set while no video is taken: video files are refused with it and not offered. */
  refusal?: string | null
}

/**
 * Where a YouTube link typed into the media dialog's "Adres" goes (a
 * product's gallery, adr/0069 §10): added to the product as a video, not
 * fetched into the library. Set `refusal` while none is taken (two videos).
 */
export interface YoutubeIntake {
  add: (url: string) => Promise<void>
  refusal?: string | null
}

// YouTube's hosts as the server takes them (adr/0069 §8); the server decides, this only routes
const YOUTUBE_HOST = /^(?:(?:www\.|m\.)?youtube\.com|youtu\.be|(?:www\.)?youtube-nocookie\.com)$/i

/**
 * Whether an address the shop typed looks like a YouTube link, a hint
 * only: it decides where the address is sent (the YouTube route or the
 * picture import). The server reads the video's id and refuses anything
 * that is not one.
 */
export function looksLikeYoutube(address: string): boolean {
  const text = address.trim()
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`)
    return (
      (url.protocol === "https:" || url.protocol === "http:") && YOUTUBE_HOST.test(url.hostname)
    )
  } catch {
    return false
  }
}

/**
 * The clips among `files` handed to the intake (or refused with its
 * reason, as a toast: nothing of them reaches the library); the rest back.
 */
export function handOnClips(files: File[], video: VideoIntake): File[] {
  const clips = files.filter((file) => video.isVideo(file))
  if (clips.length > 0) {
    if (video.refusal) {
      toast.error(video.refusal)
    } else {
      video.take(clips)
    }
  }
  return files.filter((file) => !clips.includes(file))
}

/** The file input's types: SVG where offered; videos while the intake takes them. */
export function acceptOf(svg: boolean, video: VideoIntake | undefined): string {
  if (svg) {
    return SVG_ACCEPT
  }
  return video && !video.refusal ? `${IMAGE_ACCEPT},${video.accept}` : IMAGE_ACCEPT
}
