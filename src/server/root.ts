import { router as createRouter } from './trpc';
import { chatRouter } from './routers/chat';

export const appRouter = createRouter({
  chat: chatRouter,
});

export type AppRouter = typeof appRouter; 