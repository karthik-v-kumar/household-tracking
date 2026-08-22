-- Scheduled household replacements: filters and other timed consumables.

create table if not exists upkeep_items (
  id serial primary key,
  household_id integer not null references households(id) on delete cascade,
  name text not null,
  interval_days integer not null,
  last_replaced_at timestamptz,
  spare_count integer not null default 0,
  qty_needed integer not null default 1,
  default_list_id integer references lists(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists upkeep_household_idx on upkeep_items (household_id);
create unique index if not exists upkeep_items_name_idx on upkeep_items (household_id, lower(name));
