const FALLBACK_SITE_URL = "https://fi-elsekka.vercel.app";

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    (url.origin.includes("localhost") ? FALLBACK_SITE_URL : url.origin);
  const installUrl = `${origin}/install-app`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=560x560&data=${encodeURIComponent(
    installUrl
  )}`;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
  <svg width="1600" height="2000" viewBox="0 0 1600 2000" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="220" y1="140" x2="1400" y2="1880" gradientUnits="userSpaceOnUse">
        <stop stop-color="#08100E"/>
        <stop offset="1" stop-color="#10211A"/>
      </linearGradient>
      <linearGradient id="panel" x1="310" y1="250" x2="1300" y2="1760" gradientUnits="userSpaceOnUse">
        <stop stop-color="#12211B"/>
        <stop offset="1" stop-color="#0D1714"/>
      </linearGradient>
      <linearGradient id="accent" x1="460" y1="1060" x2="1160" y2="1500" gradientUnits="userSpaceOnUse">
        <stop stop-color="#4BC0A1"/>
        <stop offset="1" stop-color="#0FAE7D"/>
      </linearGradient>
    </defs>

    <rect width="1600" height="2000" fill="url(#bg)"/>
    <circle cx="1280" cy="240" r="190" fill="#0FAE7D" fill-opacity="0.12"/>
    <circle cx="260" cy="1680" r="240" fill="#E58EAA" fill-opacity="0.08"/>

    <rect x="280" y="220" width="1040" height="1560" rx="60" fill="url(#panel)" stroke="#22362F" stroke-width="2"/>

    <rect x="350" y="300" width="900" height="116" rx="58" fill="#10231D" stroke="#214136"/>
    <text x="800" y="374" text-anchor="middle" fill="#4BC0A1" font-size="42" font-family="Arial, sans-serif" font-weight="700">
      نزّل تطبيق في السكة
    </text>

    <text x="800" y="620" text-anchor="middle" fill="#F6F8F7" font-size="116" font-family="Arial, sans-serif" font-weight="700">
      في السكة
    </text>
    <text x="800" y="710" text-anchor="middle" fill="#C6D0CB" font-size="54" font-family="Arial, sans-serif" font-weight="600">
      تطبيق المشاوير للموبايل
    </text>
    <text x="800" y="820" text-anchor="middle" fill="#91A09A" font-size="36" font-family="Arial, sans-serif" font-weight="400">
      امسح الكود من موبايلك وافتح صفحة التثبيت مباشرة
    </text>
    <text x="800" y="875" text-anchor="middle" fill="#91A09A" font-size="36" font-family="Arial, sans-serif" font-weight="400">
      احجز من وإلى بسهولة وتابع الطلب أول بأول
    </text>

    <rect x="470" y="1040" width="660" height="660" rx="44" fill="white"/>
    <rect x="430" y="1000" width="740" height="740" rx="60" fill="url(#accent)" fill-opacity="0.18"/>
    <image href="${escapeXml(qrUrl)}" x="520" y="1090" width="560" height="560"/>

    <rect x="410" y="1810" width="780" height="78" rx="39" fill="#10231D" stroke="#214136"/>
    <text x="800" y="1859" text-anchor="middle" fill="#D5DDD8" font-size="28" font-family="Arial, sans-serif" font-weight="500">
      ${escapeXml(installUrl)}
    </text>
  </svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
