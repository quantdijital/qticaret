import { cn } from "@qticaret/ui/lib/utils"

/**
 * The brush stroke under a hand note (the cover's corner note, a figures
 * strip's note): two strokes in the current ink, tilted with the note, for
 * the eye only.
 */
export function BrushStroke({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 120 14"
      className={cn("mx-auto mt-1 h-3 w-28 -rotate-6", className)}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
    >
      <path d="M4 10C30 5 64 3 116 4" strokeWidth="3.5" />
      <path d="M14 12C44 8 74 7 104 8" strokeWidth="1.5" opacity="0.7" />
    </svg>
  )
}
