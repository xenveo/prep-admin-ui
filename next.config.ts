import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/** Origin of the API, read at build time; also its ws:/wss: form for socket connections. */
function apiOrigins(): string[] {
  try {
    const api = new URL(process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api");
    const ws = new URL(api.origin);
    ws.protocol = api.protocol === "https:" ? "wss:" : "ws:";
    return [api.origin, ws.origin];
  } catch {
    return [];
  }
}

/** An entry's http(s) origin, or null; keeps paths and stray directives out of the header. */
function toOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : null;
  } catch {
    return null;
  }
}

/** Optional signed-storage origins (e.g. an S3 bucket) that exports and audio redirect to. */
const storageOrigins = [
  ...new Set(
    (process.env.CSP_STORAGE_ORIGINS ?? "")
      .split(/[\s,]+/)
      .map(toOrigin)
      .filter((origin): origin is string => origin !== null),
  ),
];
const [apiHttp = "", apiWs = ""] = apiOrigins();

// Nonces are incompatible with Partial Prerendering (Cache Components), and the theme script in
// app/layout.tsx is inline, so scripts follow the docs' "Without Nonces" policy with 'unsafe-inline'.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  ["connect-src 'self'", apiHttp, apiWs, ...storageOrigins].filter(Boolean).join(" "),
  ["media-src 'self' blob:", apiHttp, ...storageOrigins].filter(Boolean).join(" "),
  "worker-src 'self' blob:",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The test interview records answers with the microphone.
  { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=()" },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
