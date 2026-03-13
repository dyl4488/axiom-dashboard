import type { NextConfig } from 'next';

/**
 * AXIOM Dashboard — Next.js Configuration
 *
 * PowerSync Web SDK uses WebAssembly for its SQLite engine.
 * We need to configure headers to allow SharedArrayBuffer (required for WASM threads)
 * and mark PowerSync packages as server-external so they only run in the browser.
 */
const nextConfig: NextConfig = {
  // PowerSync Web SDK uses WASM — must run only in browser (not SSR)
  // These packages reference browser globals like indexedDB and Worker
  serverExternalPackages: ['@powersync/web'],

  webpack: (config, { isServer }) => {
    // PowerSync uses WebAssembly — configure webpack to handle .wasm files
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // On the server, we don't want PowerSync bundled at all
    if (isServer) {
      config.externals = [...(config.externals || []), '@powersync/web'];
    }

    return config;
  },

  async headers() {
    return [
      {
        // SharedArrayBuffer is required by PowerSync's WASM SQLite engine
        // COOP + COEP headers enable it in Chrome/Firefox
        source: '/(.*)',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        ],
      },
    ];
  },
};

export default nextConfig;
