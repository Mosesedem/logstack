"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { ProjectProvider } from "@/hooks/use-project";
import { RootProvider } from "fumadocs-ui/provider";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <RootProvider>
      <SessionProvider>
        <QueryClientProvider client={queryClient}>
          <ProjectProvider>
            {children}
            <Toaster />
          </ProjectProvider>
        </QueryClientProvider>
      </SessionProvider>
    </RootProvider>
  );
}
