// eslint-config-next 16 ships flat config directly, so there is no eslintrc
// compatibility layer here: `next/core-web-vitals` is imported and spread.
import coreWebVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...coreWebVitals,
  { ignores: [".next/**", "node_modules/**", "out/**", ".bundlebox/**"] },
];

export default config;
