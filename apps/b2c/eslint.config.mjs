import typescriptParser from "@typescript-eslint/parser";

const config = [
  {
    files: ["{src,scripts,tests,server,db}/**/*.{mjs,mts}", "drizzle.config.mts", "api/**/*.ts"],
    languageOptions: { ecmaVersion: "latest" },
    linterOptions: { reportUnusedDisableDirectives: "error" },
    rules: {
      "no-debugger": "error",
      "no-duplicate-imports": "error",
      "no-unreachable": "error",
      "no-var": "error",
      "prefer-const": "error",
    },
  },
  {
    files: ["**/*.mjs"],
    rules: {
      "no-redeclare": "error",
      "no-shadow-restricted-names": "error",
      "no-unused-vars": "error",
    },
  },
  {
    files: ["**/*.mts", "api/**/*.ts"],
    languageOptions: { parser: typescriptParser },
  },
  {
    files: ["src/**/*.mjs"],
    rules: {
      "no-restricted-globals": ["error", "fetch", "XMLHttpRequest", "WebSocket",
        "EventSource", "localStorage", "sessionStorage"],
    },
  },
];

export default config;
