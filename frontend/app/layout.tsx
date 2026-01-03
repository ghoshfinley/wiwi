import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WiWi - What I Want Is",
  description: "Your personal wishlist creator",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
