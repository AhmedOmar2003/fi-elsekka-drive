import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://fi-elsekka.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = [
    "",
    "/book",
    "/book/airport",
    "/book/ride",
    "/trip/confirm",
    "/trip/live",
    "/trips",
    "/notifications",
    "/account",
    "/captain/login",
    "/support",
    "/login",
    "/register",
  ];

  return pages.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency: path === "" ? "daily" : "weekly",
    priority: path === "" ? 1 : 0.7,
  }));
}
