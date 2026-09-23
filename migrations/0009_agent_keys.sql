create table if not exists agent_api_keys (
  id serial primary key,
  household_id integer not null references households(id) on delete cascade,
  user_id text not null,
  label text not null default 'Assistant',
  key_prefix text not null,
  key_hash text not null unique,
  can_write boolean not null default true,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists agent_api_keys_household_idx
  on agent_api_keys (household_id);
