import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: true,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  // pdfjs (extraction PDF→Markdown), @napi-rs/canvas (binaire natif fournissant
  // DOMMatrix à pdfjs + rastérisation pour l'OCR) et tesseract.js ne doivent pas
  // être bundlés : ils s'exécutent uniquement côté serveur (lib/pdf, lib/ocr).
  serverExternalPackages: [
    "pdfjs-dist",
    "@napi-rs/canvas",
    "tesseract.js",
    "pdf-parse",
    "libsodium-wrappers-sumo",
  ],
};

export default withNextIntl(nextConfig);
