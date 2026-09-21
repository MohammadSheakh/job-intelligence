import { fileURLToPath } from 'node:url';

/** @type {import('next').NextConfig} */
const config = {
  // frontend/ is an independent application alongside root development tooling.
  outputFileTracingRoot: fileURLToPath(new URL('.', import.meta.url)),
};

export default config;
