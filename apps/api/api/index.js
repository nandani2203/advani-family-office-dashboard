// Vercel serverless entry point.
//
// This file is deliberately plain JavaScript. Vercel's Node builder compiles
// `api/*.ts` with esbuild, which does not emit `emitDecoratorMetadata` — that
// would break Nest's dependency injection. Instead we let `nest build` (real
// tsc) produce `dist/`, and require the compiled output from here.
const { bootstrapServer } = require('../dist/serverless');

let cachedHandler;

module.exports = async function handler(req, res) {
  if (!cachedHandler) {
    cachedHandler = await bootstrapServer();
  }
  return cachedHandler(req, res);
};
