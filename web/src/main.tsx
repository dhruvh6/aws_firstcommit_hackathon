import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App.js';
import './styles/index.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
});

async function start(): Promise<void> {
  if (import.meta.env.VITE_USE_MOCKS === 'true') {
    const { worker } = await import('./mocks/browser.js');
    await worker.start({
      onUnhandledRequest(request, print) {
        // Only the mocked API surface lives under /v1/ (mocks/handlers.ts).
        // Page navigations, HMR pings and Vite's own dev-server requests
        // (/@vite/client, /src/*, /node_modules/.vite/*, ...) are neither
        // mocked nor meant to be - warning about those is just noise.
        if (new URL(request.url).pathname.includes('/v1/')) {
          print.warning();
        }
      },
    });
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>,
  );
}

void start();
