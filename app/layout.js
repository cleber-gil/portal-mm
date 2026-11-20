import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata = {
  title: { default: "Portal MM", template: "%s · Portal MM" },
  description: "Portal interno Martha Medeiros",
  applicationName: "Portal MM",
  appleWebApp: { capable: true, title: "Portal MM", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: "/icons/favicon-64.png", sizes: "64x64", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

// viewport-fit=cover libera a área do notch; as margens seguras ficam no CSS
export const viewport = { themeColor: "#dfe9ef", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
