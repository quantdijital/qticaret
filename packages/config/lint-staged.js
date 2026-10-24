// Shared lint-staged rules. lint-staged uses the config closest to each staged
// file and runs it from that directory, so every package re-exports this and
// ESLint picks up the package's own type-aware config.
//   export { default } from "@qticaret/config/lint-staged"
export default {
  "*": "prettier --write --ignore-unknown",
  "*.{ts,tsx,js,mjs,cjs}": "eslint --max-warnings=0 --no-warn-ignored",
}
