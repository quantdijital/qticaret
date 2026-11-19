// The rich text's variants in small (adr/0073 §3), for the "Biçim" choice:
// a plain sketch in the current colour, 112 by 32

/** A few lines of text from `x`, `w` wide. */
const Lines = ({ x, y, w }: { x: number; y: number; w: number }) => (
  <>
    {[0, 5, 10].map((dy, index) => (
      <rect
        key={dy}
        x={x}
        y={y + dy}
        width={index === 2 ? w * 0.7 : w}
        height={2}
        rx={1}
        className="fill-current opacity-45"
      />
    ))}
  </>
)

/** Today's pane: the heading on the left, the text on the right. */
export function RichTextPane() {
  return (
    <>
      <rect x={1} y={2} width={110} height={28} rx={4} className="fill-current opacity-15" />
      <rect x={8} y={9} width={30} height={4} rx={1} className="fill-current opacity-80" />
      <Lines x={50} y={9} w={54} />
    </>
  )
}

/** "Görselli metin": the picture on one side, the heading and text on the other. */
export function RichTextWithImage() {
  return (
    <>
      <rect x={1} y={2} width={110} height={28} rx={4} className="fill-current opacity-15" />
      <rect x={1} y={2} width={44} height={28} rx={4} className="fill-current opacity-45" />
      <rect x={52} y={7} width={30} height={4} rx={1} className="fill-current opacity-80" />
      <Lines x={52} y={15} w={52} />
    </>
  )
}
