import { ImageResponse } from "next/og";

// Home-screen icon for iPhone/iPad: the same tile as app/icon.svg, rendered as a PNG
// (Apple devices need a raster image). iOS adds its own rounded corners.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#1d3352"/><circle cx="32" cy="18.5" r="6" fill="#f2b98c"/><path d="M10.5 48 L21 23 L32 40.5 L43 23 L53.5 48" fill="none" stroke="#f8f4ec" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export default function AppleIcon() {
  return new ImageResponse(
    <img src={`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`} width={180} height={180} alt="" />,
    size,
  );
}
