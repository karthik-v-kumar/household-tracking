create table if not exists push_vapid (
  id integer primary key check (id = 1),
  public_key text not null,
  private_key text not null,
  subject text not null,
  created_at timestamptz not null default now()
);

create table if not exists push_subscriptions (
  id serial primary key,
  household_id integer not null references households(id) on delete cascade,
  user_id text not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_member_idx
  on push_subscriptions (household_id, user_id);
