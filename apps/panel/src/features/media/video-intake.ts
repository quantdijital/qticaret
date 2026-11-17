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
