// Permite instalar o portal na tela inicial do celular (abre em tela cheia, sem barra do navegador)
export default function manifest() {
  return {
    name: "Portal MM · Martha Medeiros",
    short_name: "Portal MM",
    description: "Produto, vendas, estoque e clientes da Martha Medeiros",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#dfe9ef",
    theme_color: "#bfd0dc",
    lang: "pt-BR",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Vendas", url: "/vendas", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Estoque", url: "/estoque", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
