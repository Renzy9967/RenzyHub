import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "RenzyHub Key System",
  description: "RenzyHub checkpoint key system",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}