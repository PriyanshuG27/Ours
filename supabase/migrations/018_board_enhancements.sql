alter table board_cards
  add column partner_acknowledged boolean not null default false,
  add column author_ready boolean not null default false,
  add column partner_ready boolean not null default false,
  add column encrypted_author_perspective text,
  add column encrypted_partner_perspective text,
  add column mood_tag text;
