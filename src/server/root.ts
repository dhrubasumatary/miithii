import { router } from './trpc';
import { chatRouter } from './routers/chat';

export const appRouter = router({
  chat: chatRouter,
});

export type AppRouter = typeof appRouter;