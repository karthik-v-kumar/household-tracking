alter table households
  add column if not exists last_notice jsonb;
