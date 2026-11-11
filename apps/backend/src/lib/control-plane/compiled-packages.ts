import { sep } from "node:path"

/**
 * The shared packages a deployed shop loads must be their compiled copies
 * (adr/0061 Ek C10): `@qticaret/server-kit` and the control-plane contract
 * resolve to `dist` only under `--conditions=qt-compiled`. A deployed boot
 * that resolves their TypeScript source would run only while a ts-node
 * happens to be there; it is refused at boot instead, naming the condition.
 * On a developer's machine and in tests the source is what they load.
 */
export const COMPILED_PACKAGES = ["@qticaret/server-kit", "@qticaret/types/control-plane"] as const

export function uncompiledPackages(
  resolve: (name: string) => string = (name) => require.resolve(name)
): string[] {
  return COMPILED_PACKAGES.filter((name) => !resolve(name).includes(`${sep}dist${sep}`))
}

export function assertCompiledPackages(local: boolean, resolve?: (name: string) => string): void {
  const missing = local ? [] : uncompiledPackages(resolve)
  if (missing.length > 0) {
    throw new Error(
      `${missing.join(", ")} resolved to TypeScript source: a deployed shop runs with NODE_OPTIONS=--conditions=qt-compiled after \`pnpm turbo run build\``
    )
  }
}
