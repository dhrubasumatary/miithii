import { ImageResponse } from "next/og";
import { MiithiiArtwork } from "@/components/brand/MiithiiArtwork";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(<MiithiiArtwork />, {
    ...size,
  });
}
