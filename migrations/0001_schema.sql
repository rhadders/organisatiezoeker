-- Organisatiezoeker · schema v1
-- Draait via scripts/migrate.mjs als rol postgres (bypasst RLS). De app leest en
-- schrijft via dezelfde rol; RLS staat aan als tweede grens voor PostgREST.

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- Rollen van contactpersonen: een selectie, nooit een beperking.
create table if not exists roles (
  key text primary key,
  label text not null,
  applies_to text not null check (applies_to in ('kerk','goed_doel','beide')),
  sort_order int not null default 100
);

insert into roles (key, label, applies_to, sort_order) values
  ('scriba', 'Scriba', 'kerk', 10),
  ('kerkelijk_bureau', 'Kerkelijk bureau / secretariaat', 'kerk', 20),
  ('predikant', 'Predikant / pastoor', 'kerk', 30),
  ('voorzitter', 'Voorzitter kerkenraad', 'kerk', 40),
  ('diaconie', 'Diaconie', 'kerk', 50),
  ('kerkrentmeesters', 'Kerkrentmeesters / beheer', 'kerk', 60),
  ('jeugdwerk', 'Jeugdwerk', 'kerk', 70),
  ('communicatie', 'Communicatie / kerkblad', 'beide', 80),
  ('marketing', 'Marketing', 'goed_doel', 90),
  ('fondsenwerving', 'Fondsenwerving', 'goed_doel', 100),
  ('directie', 'Directie / bestuur', 'goed_doel', 110),
  ('algemeen', 'Algemeen adres', 'beide', 900)
on conflict (key) do nothing;

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('kerk','goed_doel')),
  name text not null,
  place text,
  province text,
  website text,
  rsin text,
  kvk_number text,
  denomination text,           -- PKN, CGK, NGK, HHK, ...
  classis text,
  general_email text,
  postal_address text,
  source_list text,            -- bron van de basisregel (bv. 'cgk.nl gemeentelijst')
  source_url text,
  external_key text,           -- stabiele sleutel uit de bronlijst, voor hersynchronisatie
  enrichment_status text not null default 'nieuw'
    check (enrichment_status in ('nieuw','bezig','compleet','controleren','niets_gevonden','fout')),
  enriched_at timestamptz,
  blocked_at timestamptz,      -- 'vergeet deze organisatie'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists organizations_external_key_idx
  on organizations (denomination, external_key) where external_key is not null;
create index if not exists organizations_type_denom_idx on organizations (type, denomination);
create index if not exists organizations_province_idx on organizations (province);
create index if not exists organizations_name_trgm_idx on organizations using gin (name gin_trgm_ops);
create index if not exists organizations_place_trgm_idx on organizations using gin (place gin_trgm_ops);

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  display_name text,
  role text not null references roles(key),
  email text,
  email_kind text check (email_kind in ('functioneel','persoonlijk')),
  phone text,
  source_url text,
  seen_at timestamptz,
  confidence int not null default 0 check (confidence between 0 and 100),
  status text not null default 'te_controleren'
    check (status in ('zeker','te_controleren','verworpen')),
  evidence text,
  reason text,
  origin text not null default 'extractie' check (origin in ('extractie','handmatig','bronlijst')),
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists contacts_org_idx on contacts (organization_id) where is_current;
create index if not exists contacts_role_idx on contacts (role) where is_current;
create index if not exists contacts_status_idx on contacts (status) where is_current;
create index if not exists contacts_email_idx on contacts (lower(email));

create table if not exists sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  kind text not null check (kind in ('gemeentelijst','koepel','website','anbi','contact','pagina','pdf','kvk')),
  url text not null,
  fetched_at timestamptz not null default now(),
  http_status int,
  content_hash text,
  content_text text,           -- platte tekst, gecomprimeerd door Postgres (toast)
  title text,
  unique (organization_id, url)
);

create table if not exists enrichment_runs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  filter_json jsonb not null default '{}'::jsonb,
  status text not null default 'wachtrij'
    check (status in ('wachtrij','bezig','gepauzeerd','klaar','fout')),
  total int not null default 0,
  done int not null default 0,
  found_role int not null default 0,
  review_count int not null default 0,
  not_found int not null default 0,
  cost_cents numeric(10,2) not null default 0,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references enrichment_runs(id) on delete cascade,
  organization_id uuid references organizations(id) on delete cascade,
  step text not null check (step in ('import_denomination','enrich','kvk')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'wachtrij'
    check (status in ('wachtrij','bezig','klaar','fout','overgeslagen')),
  attempts int not null default 0,
  last_error text,
  scheduled_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists jobs_queue_idx on jobs (scheduled_at) where status = 'wachtrij';
create index if not exists jobs_run_idx on jobs (run_id);

create table if not exists exports (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  filter_json jsonb not null default '{}'::jsonb,
  column_set text[] not null,
  email_preference text[] not null,     -- bv {scriba,kerkelijk_bureau,algemeen}
  all_contacts boolean not null default false,
  include_personal boolean not null default false,
  skip_recent_days int not null default 0,
  format text not null check (format in ('xlsx','csv')),
  row_count int not null default 0,
  file_name text,
  file_bytes bytea,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists export_rows (
  export_id uuid not null references exports(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  primary key (export_id, organization_id)
);
create index if not exists export_rows_org_idx on export_rows (organization_id);

create table if not exists change_log (
  id bigserial primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  field text not null,
  old_value text,
  new_value text,
  source_url text,
  changed_at timestamptz not null default now()
);
create index if not exists change_log_org_idx on change_log (organization_id, changed_at desc);

create table if not exists audit_log (
  id bigserial primary key,
  actor text,
  action text not null,
  subject text,
  details jsonb,
  created_at timestamptz not null default now()
);

create table if not exists saved_selections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  filter_json jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists ai_calls (
  id bigserial primary key,
  organization_id uuid references organizations(id) on delete set null,
  model text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cost_cents numeric(10,4) not null default 0,
  created_at timestamptz not null default now()
);

-- updated_at bijhouden
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists organizations_updated_at on organizations;
create trigger organizations_updated_at before update on organizations
  for each row execute function set_updated_at();
drop trigger if exists contacts_updated_at on contacts;
create trigger contacts_updated_at before update on contacts
  for each row execute function set_updated_at();

-- RLS: alleen een ingelogde gebruiker met een aal2-sessie (tweestapsverificatie)
-- mag via PostgREST lezen en schrijven. De app zelf gebruikt de rol postgres.
create or replace function mfa_satisfied() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
$$;
revoke all on function mfa_satisfied() from public, anon;
grant execute on function mfa_satisfied() to authenticated;

do $$
declare t text;
begin
  foreach t in array array['roles','organizations','contacts','sources','enrichment_runs','jobs',
    'exports','export_rows','change_log','audit_log','saved_selections','ai_calls']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_member', t);
    execute format('create policy %I on %I for all to authenticated using (mfa_satisfied()) with check (mfa_satisfied())', t || '_member', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
  end loop;
end $$;
grant usage on all sequences in schema public to authenticated;
