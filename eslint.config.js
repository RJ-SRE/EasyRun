import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      ".tools/**",
      ".cache/**",
      ".pnpm-store/**",
      "node_modules/**",
      "dist/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["scripts/*.mjs"],
    languageOptions: {
      globals: { process: "readonly", console: "readonly", URL: "readonly" },
    },
  },
  {
    files: [
      "prototypes/runlab/build-belfry.mjs",
      "prototypes/runlab/belfry-level.mjs",
      "prototypes/runlab/belfry-city-art.mjs",
      "prototypes/runlab/test-belfry*.mjs",
    ],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        URL: "readonly",
        Image: "readonly",
        document: "readonly",
        window: "readonly",
        latestState: "readonly",
        runtimeErrors: "readonly",
        runEvents: "readonly",
        localStorage: "readonly",
        innerWidth: "readonly",
        requestAnimationFrame: "readonly",
        frameIntervals: "readonly",
        soundDiagnostics: "readonly",
        fetch: "readonly",
        AudioContext: "readonly",
        foes: "readonly",
        inscriptionDiagnostics: "readonly",
        sessionStorage: "readonly",
        Storage: "readonly",
        Event: "readonly",
      },
    },
  },
  {
    files: [
      "prototypes/runlab/public/belfry*.js",
      "prototypes/runlab/public/inscription*.js",
      "prototypes/runlab/public/cet4-words.js",
    ],
    languageOptions: {
      globals: {
        window: "readonly",
        document: "readonly",
        localStorage: "readonly",
        location: "readonly",
        AudioContext: "readonly",
        performance: "readonly",
        ResizeObserver: "readonly",
        URL: "readonly",
        Blob: "readonly",
        TextEncoder: "readonly",
        fetch: "readonly",
        atob: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        requestAnimationFrame: "readonly",
        crypto: "readonly",
        sessionStorage: "readonly",
        URLSearchParams: "readonly",
      },
    },
  },
);
