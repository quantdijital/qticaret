// Root files only (packages have their own config, see @qticaret/config/lint-staged).
// The root has no ESLint project, so only formatting runs here.
export default {
  "*": "prettier --write --ignore-unknown",
}
