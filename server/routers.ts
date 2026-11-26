import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { publicProcedure, router } from "./_core/trpc";
import { bulletinRouter, connectRouter, mutationProcedure, pilotRouter } from "./church";

export const appRouter = router({
  // Keep the starter health contract; this pilot deliberately has no email/notification feature.
  system: router({
    health: publicProcedure
      .input(z.object({ timestamp: z.number().min(0) }))
      .query(() => ({ ok: true })),
  }),
  auth: router({
    me: publicProcedure.query(({ ctx }) => ctx.user),
    logout: mutationProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  pilot: pilotRouter,
  bulletin: bulletinRouter,
  connect: connectRouter,
});

export type AppRouter = typeof appRouter;
