import webpush from "web-push";
import type { Sql } from "@/lib/db";
import type { MembershipRow } from "./access";

const VAPID_SUBJECT = "https://stocked.grok.me";

type VapidRow = { public_key: string; private_key: string; subject: string };

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

function actorLabel(membership: MembershipRow) {
  return membership.display_name?.trim() || "Someone";
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
  try {
    const vapid = await loadVapid(sql);
    const rows = await sql<{ endpoint: string; p256dh: string; auth: string; user_id: string }>`
      select endpoint, p256dh, auth, user_id
      from push_subscriptions
      where household_id = ${input.membership.id} and user_id <> ${input.actorUserId}
    `;
    if (rows.length === 0) return;

    const count = input.count ?? 1;
    const who = actorLabel(input.membership);
    const body =
      count > 1
        ? `${who} added ${count} items to ${input.listName}`
        : `${who} added ${input.itemName ?? "an item"} to ${input.listName}`;
    const payload = JSON.stringify({
      title: input.listName,
      body,
      url: `/lists/${input.listId}`,
    });

    webpush.setVapidDetails(vapid.subject, vapid.public_key, vapid.private_key);

    await Promise.all(
      rows.map(async (row) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: row.endpoint,
              keys: { p256dh: row.p256dh, auth: row.auth },
            },
            payload,
            { TTL: 60 * 60 },
          );
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await sql`delete from push_subscriptions where endpoint = ${row.endpoint}`;
          }
        }
      }),
    );
  } catch (err) {
    console.error("[push] notify failed", err);
  }
}
