import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier";
import globals from "globals";
const desktopImports = [{ name: "electron", message: "렌더러는 window.chagok 브리지만 사용합니다." }];
const desktopPatterns = [
  {
    group: ["node:*", "@/main", "@/main/**", "@/preload", "@/preload/**", "**/main/**", "**/preload/**"],
    message: "OS 접근은 main/preload에만 둡니다.",
  },
];
const boundaryPatterns = [
  {
    group: ["@/domains", "@/domains/**", "**/domains/**"],
    message: "shared와 atomics는 domains에 의존할 수 없습니다.",
  },
  { group: ["@/app", "@/app/**", "**/app/**"], message: "shared와 atomics는 app에 의존할 수 없습니다." },
];
export default tseslint.config(
  { ignores: ["node_modules/**", "out/**", "release/**", "dist/**", "test-results/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: { "react-hooks/rules-of-hooks": "error", "react-hooks/exhaustive-deps": "error" },
  },
  {
    files: ["src/{app,atomics,domains}/**/*.{ts,tsx}"],
    rules: { "no-restricted-imports": ["error", { paths: desktopImports, patterns: desktopPatterns }] },
  },
  {
    files: ["src/{shared,atomics}/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        { paths: desktopImports, patterns: [...desktopPatterns, ...boundaryPatterns] },
      ],
    },
  },
  prettier,
);
