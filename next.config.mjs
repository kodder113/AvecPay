// Coinbase's SDK (pulled in by the wallet kit) imports these optional x402
// payment packages; nothing in Avec Pay calls them.
const X402_MODULES = [
  "@x402/core/client",
  "@x402/core/schemas",
  "@x402/core/server",
  "@x402/evm",
  "@x402/evm/auth-capture/client",
  "@x402/evm/batch-settlement/client",
  "@x402/evm/exact/client",
  "@x402/evm/exact/server",
  "@x402/evm/exact/v1/client",
  "@x402/evm/upto/client",
  "@x402/evm/upto/server",
  "@x402/express",
  "@x402/extensions/bazaar",
  "@x402/extensions/builder-code",
  "@x402/fetch",
  "@x402/svm/exact/client",
  "@x402/svm/exact/server",
  "@x402/svm/exact/v1/client",
  "@x402/svm/upto/client",
  "@x402/svm/upto/server",
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // Optional packages that wallet libraries reference but Avec Pay never
    // uses (server logging, React Native storage, x402 payment signing).
    // Resolve them to empty modules so the bundle builds.
    config.resolve.alias = {
      ...config.resolve.alias,
      "pino-pretty": false,
      "@react-native-async-storage/async-storage": false,
      ...Object.fromEntries(X402_MODULES.map((m) => [m, false])),
    };
    config.externals.push("lokijs", "encoding");
    return config;
  },
};

export default nextConfig;
