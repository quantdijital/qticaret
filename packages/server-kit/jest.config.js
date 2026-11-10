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
  testEnvironment: "node",
  moduleFileExtensions: ["js", "ts", "json"],
  testMatch: ["**/src/**/__tests__/**/*.spec.ts"],
}
