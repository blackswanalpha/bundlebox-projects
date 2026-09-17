import "./globals.css";

// The production alias Vercel serves this project on. It is the canonical URL
// and the base every Open Graph image resolves against, so it has to be the
// deployment that actually answers, not the name the project was linked under.
const SITE = "https://bundlebox-beige.vercel.app";
const TITLE = "bundlebox — the zero-token software factory for AI coding agents";
const DESCRIPTION =
  "An agent is billed for what it reads, and most of what it reads is orientation, not judgement. " +
  "bundlebox answers every question a parse, a count or a set difference can answer before the agent opens, " +
  "packs the rest into one window, and measures what the session used and what it was spared.";

export const metadata = {
  metadataBase: new URL(SITE),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "bundlebox",
  keywords: [
    "AI coding agents", "context engineering", "token optimization", "Claude Code",
    "Codex", "Gemini CLI", "Cursor", "Aider", "OpenCode", "MCP", "static analysis",
  ],
  authors: [{ name: "Kamande Mbugua" }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website", url: SITE, siteName: "bundlebox",
    title: TITLE, description: DESCRIPTION,
    images: [{ url: "/logo-wordmark.svg", width: 1240, height: 300, alt: "bundlebox" }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/logo-wordmark.svg"] },
  robots: { index: true, follow: true },
};

// The page is one colour scheme by design: the mark is lit against a deep field
// and a paper variant would be a second brand, not a theme. `colorScheme` tells
// the browser so form controls and scrollbars match instead of flashing white.
export const viewport = { themeColor: "#03110C", colorScheme: "dark" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
