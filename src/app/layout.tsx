import type { Metadata } from "next";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "Dad's Diary",
  description: "A simple way for dads to capture memories.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-50">
        {children}
      </body>
    </html>
  );
}
