/** @type {import('next').NextConfig} */
const nextConfig = {
  // node-ical drags in @js-temporal/polyfill (JSBI BigInt), which throws
  // "BigInt is not a function" when bundled by Turbopack. Keep it external so
  // it's required natively at runtime (Node), where BigInt works — and so the
  // server-only parser never leaks into the client bundle.
  serverExternalPackages: ['node-ical'],
};

export default nextConfig;
