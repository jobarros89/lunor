import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LUNOR",
    short_name: "LUNOR",
    description: "Prepare o culto, cuide do time e conduza com propósito.",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      { src: "/icons/lunor-icon-192-v2.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/lunor-icon-512-v2.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
    ],
  };
}
