"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { LoadingBlock } from "@/components/ui";
import { useAuth } from "@/lib/auth";

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center">
        <LoadingBlock label="Opening your workspace…" />
      </div>
    );
  }
  return <AppShell>{children}</AppShell>;
}
