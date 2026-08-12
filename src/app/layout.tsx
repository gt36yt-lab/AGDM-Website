import type { Metadata } from "next";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import "./globals.css";

const sans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

const serif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-serif",
});

export const metadata: Metadata = {
  title: "AG Daily Motivation",
  description: "A daily dose of motivation from AG.",
  icons: [
    { rel: "icon", url: "/images/logo.jpg" },
    { rel: "shortcut icon", url: "/images/logo.jpg" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${serif.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
