-- Household clock other phones poll so a check-off in the aisle shows up immediately.
alter table households
  add column if not exists updated_at timestamptz not null default now();
