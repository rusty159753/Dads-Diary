import { createServerClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = cookies();

  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
