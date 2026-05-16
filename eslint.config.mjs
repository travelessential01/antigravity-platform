import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    // Framework build artifacts
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "supabase/**",
    // k6 load test scripts — not part of the Next.js application
    "tests/**",
    // Any minified/vendor bundles accidentally picked up
    "**/*.min.js",
    "public/**",
  ]),
]);

export default eslintConfig;
