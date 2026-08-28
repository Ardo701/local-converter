import path from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": path.resolve(process.cwd()),
    };
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        stream: false,
        zlib: false,
        http: false,
        https: false,
      };
    }
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      // dart-sass and emscripten bundles use dynamic require() internally.
      { message: /require function is used in a way in which dependencies cannot be statically extracted/ },
      { message: /Critical dependency: the request of a dependency is an expression/ },
      { message: /Accessing import\.meta directly is unsupported/ },
    ];
    return config;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
        ],
      },
    ];
  },
};
export default nextConfig;
