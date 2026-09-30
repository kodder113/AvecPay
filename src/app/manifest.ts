import type { MetadataRoute } from "next";

/** Lets people add Avec to their home screen and open it like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Avec Pay",
    short_name: "Avec",
    description: "Cobra con QR y recibe pagos directo en tu cuenta.",
    start_url: "/cobrar",
    display: "standalone",
    background_color: "#1B1E25",
    theme_color: "#1B1E25",
    icons: [{ src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" }],
  };
}
