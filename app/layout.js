import "./globals.css";

export const metadata = {
  title: "Portal MM",
  description: "Portal interno Martha Medeiros",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
