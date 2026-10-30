/**
 * A browser's user agent, read for a person: "Chrome 141 · macOS". Only
 * the common browsers and systems; anything else keeps its raw text, which
 * the audit entry's detail shows beside it anyway.
 */

// Order matters: Edge and Opera also say Chrome, Chrome also says Safari
const BROWSERS: [RegExp, string][] = [
  [/Edg(?:e|A|iOS)?\/(\d+)/, "Edge"],
  [/OPR\/(\d+)/, "Opera"],
  [/SamsungBrowser\/(\d+)/, "Samsung Internet"],
  [/YaBrowser\/(\d+)/, "Yandex"],
  [/Firefox\/(\d+)/, "Firefox"],
  [/FxiOS\/(\d+)/, "Firefox"],
  [/CriOS\/(\d+)/, "Chrome"],
  [/Chrome\/(\d+)/, "Chrome"],
  [/Version\/(\d+)[\d.]* (?:Mobile\/\S+ )?Safari\//, "Safari"],
]

const SYSTEMS: [RegExp, string][] = [
  [/iPhone|iPad|iPod/, "iOS"],
  [/Android/, "Android"],
  [/Windows/, "Windows"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/CrOS/, "ChromeOS"],
  [/Linux/, "Linux"],
]

/** "Chrome 141 · macOS", or null when neither part is known. */
export function describeUserAgent(agent: string): string | null {
  const browser = BROWSERS.flatMap(([pattern, name]) => {
    const version = pattern.exec(agent)?.[1]
    return version ? [`${name} ${version}`] : []
  })[0]
  const system = SYSTEMS.find(([pattern]) => pattern.test(agent))?.[1]
  const parts = [browser, system].filter((part): part is string => part !== undefined)
  return parts.length > 0 ? parts.join(" · ") : null
}
