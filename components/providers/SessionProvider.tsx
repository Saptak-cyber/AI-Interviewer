"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";

export default function SessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NextAuthSessionProvider
      refetchOnWindowFocus={false}
      refetchInterval={0}
    >
      {children}
    </NextAuthSessionProvider>
  );
}
