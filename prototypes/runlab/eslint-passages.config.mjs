import js from "@eslint/js";
export default [
  js.configs.recommended,
  {
    languageOptions: {
      globals: Object.fromEntries(
        [
          "process",
          "performance",
          "MediaRecorder",
          "AudioNode",
          "Event",
          "Blob",
          "OfflineAudioContext",
          "passageSound",
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
