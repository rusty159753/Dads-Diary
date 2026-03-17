import "./globals.css"
// import { createServerClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import { ReactNode } from 'react';

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
