// The CSP is a property of the deployed site, so it is set on the deployed
// build only. The dev server loads its own instrumentation — eval() for React's
// callstacks, a websocket for HMR, blob workers for Turbopack — and a header
// tight enough to be worth shipping stops it hydrating at all, which turns
// every client component into dead server HTML while you are looking at it.
const dev = process.env.NODE_ENV !== "production";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The dev server refuses cross-origin requests for /_next/hmr by default, and
  // a browser that reaches it on 127.0.0.1 while Next expects localhost counts
  // as cross-origin: the HMR client never connects and the page never hydrates.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  // The brand mark is an SVG pulled from the repository by scripts/pull-assets.sh,
  // so it is first-party and versioned rather than arbitrary uploaded markup —
  // which is the case `dangerouslyAllowSVG` exists to keep out. The sandbox
  // below holds anyway: no scripts, no external references.
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  // The page is fully static and every asset is fingerprinted by the build, so
  // the only header worth setting by hand is the one Next cannot infer: what
  // this document is allowed to load. It loads nothing off-origin.
  async headers() {
    if (dev) return [];
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Next inlines the bootstrap and the flight payload; both are
              // build output, not user input, and the page takes no input at all.
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data:",
              "font-src 'self'",
              "connect-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
