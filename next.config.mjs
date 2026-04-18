import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Your Next.js config here
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
