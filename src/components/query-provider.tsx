import { type ReactNode, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LiveSync } from "@/components/live-sync";

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1_000,
            refetchOnWindowFocus: "always",
            refetchOnReconnect: "always",
            retry: 1,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <LiveSync />
      {children}
    </QueryClientProvider>
  );
}
