import { ImageResponse } from "next/og";
import { MiithiiArtwork } from "@/components/brand/MiithiiArtwork";

export const size = {
  width: 1200,
  height: 675,
};

export const contentType = "image/png";

export default function TwitterImage() {
  return new ImageResponse(<MiithiiArtwork />, {
    ...size,
  });
}
