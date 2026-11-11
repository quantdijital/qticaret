// The backend's transform (apps/backend/jest.config.js): the moved specs run unchanged
module.exports = {
  transform: {
    "^.+\\.[jt]s$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript" },
        },
      },
    ],
  },
  // age-encryption ships ES modules only: Node loads it (require(esm)),
  // outside Jest's registry, as the apps' runtime does (jest.age.cjs)
  moduleNameMapper: { "^age-encryption$": "<rootDir>/jest.age.cjs" },
  testEnvironment: "node",
  moduleFileExtensions: ["js", "ts", "json"],
  testMatch: ["**/src/**/__tests__/**/*.spec.ts"],
}
