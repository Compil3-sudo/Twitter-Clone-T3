import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";

export const tweetRouter = createTRPCRouter({
  infiniteFeed: publicProcedure
    .input(
      z.object({
        limit: z.number().optional(),
        cursor: z.object({ id: z.string(), createdAt: z.date() }).optional(),
      }),
    )
    .query(async ({ input: { limit = 10, cursor }, ctx }) => {
      const currentUserId = ctx.session?.user.id;

      const tweetsFeed = await ctx.db.tweet.findMany({
        take: limit + 1,
        cursor: cursor
          ? { createdAt: cursor.createdAt, id: cursor.id }
          : undefined,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          content: true,
          createdAt: true,
          _count: { select: { likes: true } },
          likes:
            currentUserId == null
              ? false
              : { where: { userId: currentUserId } },
          user: {
            select: { name: true, id: true, image: true },
          },
        },
      });

      let nextCursor: typeof cursor | undefined;

      if (tweetsFeed.length > limit) {
        const nextItem = tweetsFeed.pop();

        if (nextItem != null) {
          nextCursor = { id: nextItem.id, createdAt: nextItem.createdAt };
        }
      }

      const mappedTweetsFeed = tweetsFeed.map((tweet) => {
        return {
          id: tweet.id,
          content: tweet.content,
          createdAt: tweet.createdAt,
          likeCount: tweet._count.likes,
          user: tweet.user,
          likedByMe: tweet.likes?.length > 0,
        };
      });

      return { mappedTweetsFeed, nextCursor };
    }),
  create: protectedProcedure
    .input(z.object({ content: z.string() }))
    .mutation(async ({ input: { content }, ctx }) => {
      const tweet = await ctx.db.tweet.create({
        data: { content, userId: ctx.session.user.id },
      });

      return tweet;
    }),
});
