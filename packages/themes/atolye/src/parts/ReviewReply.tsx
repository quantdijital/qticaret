import type { ReviewReplyView } from "@qticaret/ui"

/**
 * The shop's reply under one of its reviews, in a well of its own:
 * "Mağazanın yanıtı", the shop's
 * name and the day, then its words with their line breaks. Text only:
 * a reply is not a review, nothing of it goes into structured data.
 */
export function ReviewReply({ reply, label }: { reply: ReviewReplyView; label: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-inner bg-paper-2 p-4 text-sm">
      <p className="font-semibold">
        {label}
        <span className="font-normal text-text-2">
          {" · "}
          {reply.author}
        </span>
        {reply.date.dateTime && (
          <>
            {" · "}
            <time dateTime={reply.date.dateTime} className="font-normal text-text-3">
              {reply.date.label}
            </time>
          </>
        )}
      </p>
      <p className="leading-relaxed break-words whitespace-pre-line text-text-2">{reply.text}</p>
    </div>
  )
}
