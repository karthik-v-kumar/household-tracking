-- How far ahead to remind you to buy a spare. 0 = keep one on the shelf.
alter table upkeep_items
  add column if not exists stock_lead_days integer not null default 30;
