import { Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TerminalPage } from '@/pages/terminal';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000,
      retry: 2,
    },
  },
});

function LoadingFallback() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: '#0a0c0f',
      color: '#4a5268',
      fontFamily: 'monospace',
      fontSize: 13,
      gap: 12,
    }}>
      <div style={{
        width: 18,
        height: 18,
        border: '2px solid #1e2535',
        borderTopColor: '#00d4aa',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      Initializing terminal...
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); }}`}</style>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<LoadingFallback />}>
        <TerminalPage />
      </Suspense>
    </QueryClientProvider>
  );
}
