import { z } from 'zod';
import { publicProcedure, router } from '../trpc';

export const chatRouter = router({
  sendMessage: publicProcedure
    .input(z.object({ content: z.string().min(1) }))
    .mutation(async ({ input }) => {
      return { success: true, message: `Received: ${input.content}` };
    }),
}); 