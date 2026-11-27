import { trpc } from "@/lib/trpc";
import { COOKIE_NAME } from "@shared/const";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import "@fontsource-variable/montserrat";
import "@fontsource-variable/inter";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});
const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      headers() {
        const headers: Record<string, string> = { "x-churchconnect": "1" };
        try {
          const raw = sessionStorage.getItem("manus-cookie");
          const prefix = `${COOKIE_NAME}=`;
          const pair = raw?.split(";").find(s => s.trim().startsWith(prefix));
          const token = pair?.trim().slice(prefix.length);
          if (token) headers.Authorization = `Bearer ${token}`;
        } catch {
          /* Browser may block storage; normal cookie login remains available. */
        }
        return headers;
      },
      fetch(input, init) {
        return globalThis.fetch(input, { ...init, credentials: "include" });
      },
    }),
  ],
});
createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
