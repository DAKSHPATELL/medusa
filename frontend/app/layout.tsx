import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClearBorder — Send Invoice",
  description: "Upload → Process → Verify",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
