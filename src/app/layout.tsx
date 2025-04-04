// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css"; // Ensure Tailwind base styles are imported

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "My Task App",
  description: "Task management application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {/* Apply base font and background */}
      <body className={`${inter.className} bg-gray-100`}>
        {/* Add min-h-screen if you want content to always fill viewport height */}
        <main className="min-h-screen">
          {children}
        </main>
        </body>
    </html>
  );
}