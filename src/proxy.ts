import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export default clerkMiddleware((_, request) => {
  if (request.nextUrl.pathname === "/checkout") {
    return NextResponse.redirect(new URL("/pricing", request.url));
  }

  if (request.nextUrl.pathname.startsWith("/chat") || request.nextUrl.pathname.startsWith("/payment")) {
    return NextResponse.redirect(new URL("/voice", request.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
