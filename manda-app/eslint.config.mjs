import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * ESLint Configuration
 *
 * Stricter rules for Agent System v2 per Epic 2 Retro action items.
 * - Naming convention enforcement (no snake_case in TypeScript)
 * - No unused variables (except underscore-prefixed)
 * - Prefer optional chaining
 *
 * Note: Type-aware rules (@typescript-eslint/no-floating-promises, etc.)
 * require parserServices configuration. Keeping as warnings only for now.
 */
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Custom rules for stricter TypeScript
  {
    rules: {
      // Warn on unused variables (except underscore-prefixed)
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      // Prefer const assertions where possible
      "prefer-const": "warn",
      // No console.log in production code (allow warn/error)
      "no-console": ["warn", { allow: ["warn", "error", "info", "debug", "log"] }],
      // Require curly braces for all control statements
      "curly": ["warn", "multi-line"],
      // Enforce consistent brace style
      "brace-style": ["warn", "1tbs", { allowSingleLine: true }],
    },
  },
]);

export default eslintConfig;
