import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LUNOR",
    short_name: "LUNOR",
    description: "Prepare o culto, cuide do time e conduza com propósito.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8f8f5",
    theme_color: "#f8f8f5",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
