import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

/**
 * eslint-config-next 16 ships native flat configs, so no FlatCompat shim is
 * needed (and FlatCompat fails on the plugin objects these configs embed).
 */
const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "artifacts/**",
      "playwright-report/**",
      "test-results/**",
      "next-env.d.ts",
    ],
  },
  ...nextVitals,
  ...nextTypeScript,
  {
    // React Three Fiber deliberately mutates cameras, scenes and materials
    // inside useFrame and render-capture effects. The React Compiler's
    // immutability rule cannot model that imperative API, so it is disabled
    // only for the viewer layer, not for React state or app components.
    files: ["src/components/viewer/**/*.tsx"],
    rules: {
      "react-hooks/immutability": "off",
    },
  },
];

export default config;
