import webpush from "web-push";
import type { Sql } from "@/lib/db";
import type { MembershipRow } from "./access";

const VAPID_SUBJECT = "https://stocked.grok.me";

type VapidRow = { public_key: string; private_key: string; subject: string };

export type HouseholdNotice = {
  id: number;
  actorUserId: string;
  title: string;
  body: string;
  url: string;
};

async function actorLabel(sql: Sql, membership: MembershipRow, actorUserId: string) {
  const fromMember = membership.display_name?.trim();
  if (fromMember) return fromMember;
  const rows = await sql<{ name: string | null }>`
    select name from "user" where id = ${actorUserId} limit 1
  `;
  return rows[0]?.name?.trim() || "Someone";
}

export async function loadVapid(sql: Sql): Promise<VapidRow> {
  const existing = await sql<VapidRow>`
    select public_key, private_key, subject from push_vapid where id = 1
  `;
  if (existing[0]) return existing[0];
  const keys = webpush.generateVAPIDKeys();
  await sql`
    insert into push_vapid (id, public_key, private_key, subject)
    values (1, ${keys.publicKey}, ${keys.privateKey}, ${VAPID_SUBJECT})
    on conflict (id) do nothing
  `;
  const created = await sql<VapidRow>`
    select public_key, private_key, subject from push_vapid where id = 1
  `;
  return created[0] ?? { public_key: keys.publicKey, private_key: keys.privateKey, subject: VAPID_SUBJECT };
}

export async function notifyHousehold(
  sql: Sql,
  input: {
    membership: MembershipRow;
    actorUserId: string;
    title: string;
    body: string;
    url: string;
    includeActor?: boolean;
  },
) {
  const notice: HouseholdNotice = {
    id: Date.now(),
    actorUserId: input.actorUserId,
    title: input.title,
    body: input.body,
    url: input.url,
  };

  try {
    await sql.query(
      `update households set last_notice = $1::jsonb, updated_at = now() where id = $2`,
      [JSON.stringify(notice), input.membership.id],
    );
  } catch (err) {
    console.error("[push] could not store notice", err);
  }

  try {
    const vapid = await loadVapid(sql);
    const rows = input.includeActor
      ? await sql<{ endpoint: string; p256dh: string; auth: string; user_id: string }>`
          select endpoint, p256dh, auth, user_id
          from push_subscriptions
          where household_id = ${input.membership.id}
        `
      : await sql<{ endpoint: string; p256dh: string; auth: string; user_id: string }>`
          select endpoint, p256dh, auth, user_id
          from push_subscriptions
          where household_id = ${input.membership.id} and user_id <> ${input.actorUserId}
        `;
    if (rows.length === 0) return notice;

    webpush.setVapidDetails(vapid.subject, vapid.public_key, vapid.private_key);
    const payload = JSON.stringify(notice);

    await Promise.all(
      rows.map(async (row) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: row.endpoint,
              keys: { p256dh: row.p256dh, auth: row.auth },
            },
            payload,
            { TTL: 60 * 60, urgency: "high" },
          );
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          console.error("[push] send failed", status, row.user_id);
          if (status === 404 || status === 410 || status === 401) {
            await sql`delete from push_subscriptions where endpoint = ${row.endpoint}`;
          }
        }
      }),
    );
  } catch (err) {
    console.error("[push] notify failed", err);
  }

  return notice;
}

export async function notifyListAdd(
  sql: Sql,
  input: {
    membership: MembershipRow;
    actorUserId: string;
    listId: number;
    listName: string;
    itemName?: string;
    count?: number;
  },
) {
  const who = await actorLabel(sql, input.membership, input.actorUserId);
  const count = input.count ?? 1;
  const body =
    count > 1
      ? `${who} added ${count} items to ${input.listName}`
      : `${who} added ${input.itemName ?? "an item"} to ${input.listName}`;
  return notifyHousehold(sql, {
    membership: input.membership,
    actorUserId: input.actorUserId,
    title: input.listName,
    body,
    url: `/lists/${input.listId}`,
  });
}

export async function notifyPantryChange(
  sql: Sql,
  input: {
    membership: MembershipRow;
    actorUserId: string;
    itemName: string;
    detail: string;
  },
) {
  const who = await actorLabel(sql, input.membership, input.actorUserId);
  return notifyHousehold(sql, {
    membership: input.membership,
    actorUserId: input.actorUserId,
    title: "Pantry",
    body: `${who} ${input.detail}`,
    url: "/inventory",
  });
}
