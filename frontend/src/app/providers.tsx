"use client";

import { Toaster } from "sonner";
import { SWRConfig } from "swr";
import { fetcher } from "@/lib/api";
import { AuthProvider } from "@/lib/auth";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig value={{ fetcher, revalidateOnFocus: false, keepPreviousData: true }}>
      <AuthProvider>
        {children}
        <Toaster position="top-right" richColors closeButton />
      </AuthProvider>
    </SWRConfig>
  );
}
