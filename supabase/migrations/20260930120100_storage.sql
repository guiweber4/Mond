-- Bucket privado para os arquivos originais das importações. Só o servidor (service role) grava e lê.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit)
    values ('imports', 'imports', false, 8000000)
    on conflict (id) do nothing;
  end if;
end $$;
