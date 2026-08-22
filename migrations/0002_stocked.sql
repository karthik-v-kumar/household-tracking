-- Stocked: household shopping lists, usuals catalog, and pantry inventory.

create table if not exists households (
  id serial primary key,
  name text not null,
  invite_code text not null unique,
  created_by text not null,
  created_at timestamptz not null default now()
);

create table if not exists household_members (
  household_id integer not null references households(id) on delete cascade,
  user_id text not null,
  role text not null default 'member',
  display_name text,
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index if not exists household_members_user_idx on household_members (user_id);

create table if not exists lists (
  id serial primary key,
  household_id integer not null references households(id) on delete cascade,
  name text not null,
  icon text not null default 'shopping-cart',
  color text not null default 'sage',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists lists_household_idx on lists (household_id);

create table if not exists catalog_items (
  id serial primary key,
  household_id integer not null references households(id) on delete cascade,
  name text not null,
  category text not null default 'other',
  default_list_id integer references lists(id) on delete set null,
  is_staple boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists catalog_items_name_idx on catalog_items (household_id, lower(name));

create table if not exists list_items (
  id serial primary key,
  household_id integer not null references households(id) on delete cascade,
  list_id integer not null references lists(id) on delete cascade,
  catalog_item_id integer references catalog_items(id) on delete set null,
  name text not null,
  quantity text,
  notes text,
  checked boolean not null default false,
  is_staple boolean not null default false,
  added_by text not null,
  created_at timestamptz not null default now()
);
create index if not exists list_items_list_idx on list_items (list_id, checked, id);

create table if not exists inventory_items (
  id serial primary key,
  household_id integer not null references households(id) on delete cascade,
  catalog_item_id integer references catalog_items(id) on delete set null,
  name text not null,
  category text not null default 'household',
  level text not null default 'ok',
  typical_days integer,
  last_restocked_at timestamptz,
  default_list_id integer references lists(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists inventory_household_idx on inventory_items (household_id, level);
create unique index if not exists inventory_items_name_idx on inventory_items (household_id, lower(name));
