create table if not exists catalog_item_lists (
  catalog_item_id integer not null references catalog_items(id) on delete cascade,
  list_id integer not null references lists(id) on delete cascade,
  primary key (catalog_item_id, list_id)
);

create index if not exists catalog_item_lists_list_idx on catalog_item_lists (list_id);

insert into catalog_item_lists (catalog_item_id, list_id)
select id, default_list_id
from catalog_items
where default_list_id is not null
on conflict do nothing;
