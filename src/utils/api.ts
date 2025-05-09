import { httpBatchLink, loggerLink } from '@trpc/client';
import { createTRPCNext } from '@trpc/next';
import superjson from 'superjson';
import type { AppRouter } from '@/server/root';

export const api = createTRPCNext<AppRouter>({
  config() {
    return {
      transformer: superjson,
      links: [
        loggerLink({
          enabled: (opts) => process.env.NODE_ENV === 'development',
        }),
        httpBatchLink({
          url: '/api/trpc',
        }),
      ],
    };
  },
  ssr: false,
}); 