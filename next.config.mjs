/** @type {import('next').NextConfig} */
const nextConfig = {
  // node-ical drags in @js-temporal/polyfill (JSBI BigInt), which throws
  // "BigInt is not a function" when bundled by Turbopack. Keep it external so
  // it's required natively at runtime (Node), where BigInt works — and so the
  // server-only parser never leaks into the client bundle.
  serverExternalPackages: ['node-ical'],
  // The Product Map moved from /product-map to /product. Old links, a shared
  // frame among them, keep working.
  async redirects() {
    return [
      {
        // Not /e2e: the fixture routes keep their own path.
        source: '/:slug((?!e2e)[^/]+)/product-map/:path*',
        destination: '/:slug/product/:path*',
        permanent: true,
      },
    ]
  },
};

export default nextConfig;
