import { router } from './trpc';

export const appRouter = router({
  // Add your routes here
});

export type AppRouter = typeof appRouter; 