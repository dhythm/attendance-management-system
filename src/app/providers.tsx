"use client";

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { isApiError } from "@/client/api-client";

function redirectToLoginIfUnauthorized(error: unknown) {
  if (isApiError(error) && error.code === "UNAUTHORIZED") window.location.assign("/login");
}

function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({ onError: redirectToLoginIfUnauthorized }),
    mutationCache: new MutationCache({ onError: redirectToLoginIfUnauthorized }),
    defaultOptions: {
      queries: {
        retry: (failureCount, error) =>
          !(isApiError(error) && error.status >= 400 && error.status < 500) && failureCount < 2,
      },
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(createQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
