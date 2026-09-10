import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSqlClient, requireMembership } from "./access";

export const getPushPublicKey = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async () => {
    const sql = await getSqlClient();
    const { loadVapid } = await import("./push-send");
    const vapid = await loadVapid(sql);
    return { publicKey: vapid.public_key };
  });

export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        endpoint: z.string().url(),
        keys: z.object({
          p256dh: z.string().min(8),
          auth: z.string().min(4),
        }),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSqlClient();
    const membership = await requireMembership(sql, context.userId);
    await sql`
      insert into push_subscriptions (household_id, user_id, endpoint, p256dh, auth)
      values (${membership.id}, ${context.userId}, ${data.endpoint}, ${data.keys.p256dh}, ${data.keys.auth})
      on conflict (endpoint) do update set
        household_id = excluded.household_id,
        user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth
    `;
    return { ok: true as const };
  });

export const deletePushSubscription = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z.object({ endpoint: z.string().min(8) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSqlClient();
    const membership = await requireMembership(sql, context.userId);
    await sql`
      delete from push_subscriptions
      where endpoint = ${data.endpoint} and user_id = ${context.userId} and household_id = ${membership.id}
    `;
    return { ok: true as const };
  });

export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSqlClient();
    const membership = await requireMembership(sql, context.userId);
    const { notifyHousehold } = await import("./push-send");
    await notifyHousehold(sql, {
      membership,
      actorUserId: context.userId,
      title: "Stocked",
      body: "Alerts are on. You’ll hear when they add to a list or the pantry.",
      url: "/",
      includeActor: true,
    });
    return { ok: true as const };
  });
