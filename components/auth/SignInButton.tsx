"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import Button from "@/components/ui/Button";
import Image from "next/image";

export function SignInButton() {
  return (
    <Button
      size="lg"
      onClick={() => signIn("google", { callbackUrl: "/interview" })}
      className="gap-3 bg-white hover:bg-zinc-100 text-zinc-900 border-0 shadow-lg shadow-black/20"
    >
      <Image src="/google.svg" alt="Google" width={20} height={20} />
      Continue with Google
    </Button>
  );
}

export function UserMenu() {
  const { data: session } = useSession();

  if (!session?.user) return null;

  return (
    <div className="flex items-center gap-3">
      {session.user.image && (
        <Image
          src={session.user.image}
          alt={session.user.name ?? "User"}
          width={32}
          height={32}
          className="rounded-full ring-2 ring-zinc-700"
        />
      )}
      <span className="text-sm text-zinc-300 hidden sm:block">
        {session.user.name}
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => signOut({ callbackUrl: "/" })}
      >
        Sign out
      </Button>
    </div>
  );
}
