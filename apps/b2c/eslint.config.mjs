const config = [
  {
    files: ["{src,scripts,tests}/**/*.mjs"],
    languageOptions: { ecmaVersion: "latest" },
    linterOptions: { reportUnusedDisableDirectives: "error" },
    rules: {
      "no-debugger": "error",
      "no-duplicate-imports": "error",
      "no-redeclare": "error",
      "no-shadow-restricted-names": "error",
      "no-unreachable": "error",
      "no-unused-vars": "error",
      "no-var": "error",
      "prefer-const": "error",
    },
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
