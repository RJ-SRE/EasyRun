import js from "@eslint/js";
export default [
  js.configs.recommended,
  {
    languageOptions: {
      globals: Object.fromEntries(
        [
          "process",
          "console",
          "URL",
          "Image",
          "document",
          "window",
          "localStorage",
          "innerWidth",
          "passageState",
          "passageEvents",
          "passageErrors",
          "AudioContext",
          "ResizeObserver",
          "setTimeout",
          "clearTimeout",
          "fetch",
          "atob",
          "TextEncoder",
          "location",
        ].map((name) => [name, "readonly"]),
      ),
    },
  },
];
