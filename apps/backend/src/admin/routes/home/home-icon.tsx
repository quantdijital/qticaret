/**
 * Sidebar icon for the home page. Drawn inline at the dashboard's icon size
 * (15 px, current color) because @medusajs/icons is not a dependency; without
 * an icon the sidebar shows the generic extension icon.
 */
export function HomeIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path
        d="M2.5 6.5 7.5 2.5l5 4V12a.5.5 0 0 1-.5.5H9V9H6v3.5H3a.5.5 0 0 1-.5-.5V6.5Z"
        stroke="currentColor"
        strokeWidth={1.25}
        strokeLinejoin="round"
      />
    </svg>
  )
}
