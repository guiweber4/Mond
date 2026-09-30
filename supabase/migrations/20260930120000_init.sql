-- Mondepars Intelligence · schema inicial (Supabase / Postgres).
-- Equivalente às migrações D1 0000–0004 (histórico em docs/historico/d1-migrations), sem o reset de 0003.
-- Datas continuam como texto ISO (ordenação idêntica à versão anterior); payloads guardam o JSON original.

create table if not exists imports (
  id text primary key,
  name text not null,
  kind text not null,
  created_at text not null,
  status text not null,
  count integer not null,
  hash text not null,
  file_key text not null
);
create index if not exists idx_imports_status on imports(status);
create index if not exists idx_imports_hash on imports(hash);

create table if not exists records (
  kind text not null,
  rid text not null,
  import_id text not null references imports(id),
  payload text not null,
  -- Unidade e data da posição de estoque, extraídas do payload para a consulta da versão ativa.
  pos_store text generated always as ((payload::jsonb)->>'store') stored,
  pos_date text generated always as ((payload::jsonb)->>'date') stored,
  primary key (kind, rid, import_id)
);
create index if not exists idx_records_import on records(import_id);
create index if not exists idx_records_position on records(pos_store, pos_date) where kind = 'stock';

create table if not exists settings (id text primary key, payload text not null);

create table if not exists actions (
  id text primary key,
  dataset text not null,
  status text not null,
  updated_at text not null,
  payload text not null
);

create table if not exists reports (
  id text primary key,
  dataset text not null,
  title text not null,
  created_at text not null,
  payload text not null
);

create table if not exists ai_profiles (
  id text primary key,
  name text not null,
  provider text not null,
  model text not null,
  enabled integer not null,
  cipher text not null,
  hint text not null,
  updated_at text not null
);

create table if not exists ai_quota (id text primary key, count integer not null);

create table if not exists ai_runs (
  id text primary key,
  profile_id text not null,
  provider text not null,
  model text not null,
  dataset text not null,
  purpose text not null,
  created_at text not null,
  status text not null,
  duration_ms integer not null,
  input_tokens integer,
  output_tokens integer,
  output text not null
);
create index if not exists idx_ai_runs_created on ai_runs(created_at);

-- Versão ativa de cada totalização (unidade + período).
create table if not exists total_batches (
  scope text primary key,
  store text not null,
  start text not null,
  "end" text not null,
  import_id text not null references imports(id)
);

-- Versão ativa de cada posição de estoque (unidade + data).
create table if not exists stock_batches (
  store text not null,
  date text not null,
  import_id text not null references imports(id),
  primary key (store, date)
);

-- O acesso acontece só pelo servidor (conexão Postgres direta). RLS sem políticas bloqueia a API pública do Supabase.
alter table imports enable row level security;
alter table records enable row level security;
alter table settings enable row level security;
alter table actions enable row level security;
alter table reports enable row level security;
alter table ai_profiles enable row level security;
alter table ai_quota enable row level security;
alter table ai_runs enable row level security;
alter table total_batches enable row level security;
alter table stock_batches enable row level security;
