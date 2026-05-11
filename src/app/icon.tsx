import { ImageResponse } from "next/og";
import { MiithiiArtwork } from "@/components/brand/MiithiiArtwork";

export const size = {
  width: 1024,
  height: 1024,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<MiithiiArtwork compact />, {
    ...size,
  });
}
