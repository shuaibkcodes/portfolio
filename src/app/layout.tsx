import type { Metadata, Viewport } from "next";
import { Overpass, Overpass_Mono } from "next/font/google";
import { profile } from "@/data/portfolio";
import "./globals.css";

const overpass = Overpass({ variable: "--font-overpass", subsets: ["latin"], weight: ["400", "600", "700", "800"] });
const overpassMono = Overpass_Mono({ variable: "--font-overpass-mono", subsets: ["latin"], weight: ["400", "600"] });

const description = `${profile.name} — ${profile.title}. ${profile.summary}`;

export const metadata: Metadata = {
  title: `${profile.name} — ${profile.title}`,
  description,
  authors: [{ name: profile.name, url: profile.links.linkedin }],
  openGraph: {
    title: `${profile.name} · The Road So Far`,
    description,
    type: "profile",
  },
  twitter: { card: "summary", title: `${profile.name} · The Road So Far`, description },
};

export const viewport: Viewport = {
  themeColor: "#050608",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const personJsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: profile.name,
  jobTitle: profile.title,
  email: `mailto:${profile.email}`,
  address: { "@type": "PostalAddress", addressLocality: profile.location },
  sameAs: [profile.links.linkedin, profile.links.github],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${overpass.variable} ${overpassMono.variable}`}>
      <head>
        <link rel="preload" href="/fonts/overpass-800.woff" as="font" type="font/woff" crossOrigin="anonymous" />
        <noscript>
          <style>{`#journey-loader{display:none!important}`}</style>
        </noscript>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
