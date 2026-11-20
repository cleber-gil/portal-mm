import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata = {
  title: { default: "Portal MM", template: "%s · Portal MM" },
  description: "Portal interno Martha Medeiros",
};

export const viewport = { themeColor: "#dfe9ef" };

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
