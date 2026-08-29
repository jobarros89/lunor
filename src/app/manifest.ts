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
      { src: "/icons/lunor-mark-v2.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" },
    ],
  };
}
