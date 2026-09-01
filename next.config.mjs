import path from 'path'
import { fileURLToPath } from 'url'

import { withPayload } from '@payloadcms/next/withPayload'

const dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emit `.next/standalone/server.js` plus a minimal, traced `node_modules`
  // containing only what the server actually imports. That bundle is the
  // deploy artifact — the VPS never sees the repo, pnpm, or a full
  // `node_modules` tree. See docs/DEPLOYMENT.md.
  output: 'standalone',
  // Pin the trace root so the standalone tree stays scoped to this project and
  // reproducible in CI, instead of Next walking up looking for a lockfile.
  outputFileTracingRoot: dirname,
  // `onnxruntime-node/dist/binding.js` loads its native addon through a
  // template literal:
  //
  //   require(`../bin/napi-v6/${process.platform}/${process.arch}/onnxruntime_binding.node`)
  //
  // The tracer cannot resolve that statically, so it either drags in all five
  // platform builds (~210MB) or none at all. Name the one the VPS runs, and
  // drop the rest. Both glob shapes are listed because pnpm does not hoist
  // onnxruntime-node to the top level — it is a transitive dep of
  // @huggingface/transformers and lives under `.pnpm/`.
  outputFileTracingIncludes: {
    '/**': [
      './node_modules/onnxruntime-node/bin/napi-v6/linux/x64/**',
      './node_modules/.pnpm/onnxruntime-node@*/node_modules/onnxruntime-node/bin/napi-v6/linux/x64/**',
    ],
  },
  outputFileTracingExcludes: {
    '*': [
      // Runtime state. `media/` is uploads (Payload's default staticDir is the
      // collection slug, resolved against cwd) and `.cache/` is downloaded
      // MiniLM weights. Both live in shared/ on the server and are symlinked
      // into each release — baking them in would mean every deploy overwrites
      // live user data.
      './media/**',
      './.cache/**',
      './tests/**',
      './test-results/**',
      './playwright-report/**',
      // The four onnxruntime platform builds the server will never load.
      '**/onnxruntime-node/bin/napi-v6/darwin/**',
      '**/onnxruntime-node/bin/napi-v6/win32/**',
      '**/onnxruntime-node/bin/napi-v6/linux/arm64/**',
    ],
  },
  //
  // `@huggingface/transformers` (and its `onnxruntime-node` peer) must be
  // treated as server-side externals. The library ships separate web and Node
  // builds; if Next.js bundles the package, Turbopack picks the web build,
  // strips `node:fs`, and model loading fails with "Unable to get model file
  // path or buffer". Externalising lets Node's native resolver pick the
  // correct conditional export from the package.json `exports.node` map.
  serverExternalPackages: ['@huggingface/transformers', 'onnxruntime-node'],
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
