-- Run as the database owner in Supabase. Authentication is provided by Supabase Auth.
begin;

create schema if not exists notebook_private;
revoke all on schema notebook_private from public, anon, authenticated;

create table if not exists notebook_private.notebooks (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 200),
  owner_id uuid not null references auth.users(id) on delete cascade,
  records jsonb not null default '{}'::jsonb
    check (jsonb_typeof(records) = 'object'
      and octet_length(records::text) <= 4194304)
);

create table if not exists notebook_private.members (
  group_id uuid not null references notebook_private.notebooks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  primary key (group_id, user_id),
  unique (group_id, email)
);

create table if not exists notebook_private.invitations (
  group_id uuid not null references notebook_private.notebooks(id) on delete cascade,
  email text not null,
  primary key (group_id, email)
);

create table if not exists notebook_private.clients (
  group_id uuid not null references notebook_private.notebooks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null,
  ack bigint not null default 0 check (ack between 0 and 9007199254740991),
  primary key (group_id, user_id, client_id),
  foreign key (group_id, user_id)
    references notebook_private.members(group_id, user_id) on delete cascade
);

alter table notebook_private.notebooks enable row level security;
alter table notebook_private.members enable row level security;
alter table notebook_private.invitations enable row level security;
alter table notebook_private.clients enable row level security;
revoke all on all tables in schema notebook_private from public, anon, authenticated;

create or replace function notebook_private.email(p_email text)
returns text language plpgsql set search_path = pg_catalog as $$
declare v_email text := lower(btrim(p_email));
begin
  if v_email is null or length(v_email) > 320
     or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Invalid email' using errcode = '22023';
  end if;
  return v_email;
end;
$$;

-- Every membership mutation and synchronization uses the same exclusive group lock.
create or replace function notebook_private.lock_group(p_group uuid, p_owner boolean default false)
returns void language plpgsql set search_path = pg_catalog as $$
declare v_owner uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  select owner_id into v_owner from notebook_private.notebooks
    where id = p_group for update;
  if not found or not exists (
    select 1 from notebook_private.members
    where group_id = p_group and user_id = auth.uid()
  ) or (p_owner and v_owner <> auth.uid()) then
    raise exception 'Notebook access denied' using errcode = '42501';
  end if;
end;
$$;

create or replace function notebook_private.validate_record(
  p_kind text, p_key text, p_data jsonb, p_complete boolean
) returns jsonb language plpgsql set search_path = pg_catalog as $$
declare v_data jsonb := p_data; v_field text;
begin
  if jsonb_typeof(v_data) is distinct from 'object' then
    raise exception 'Record data must be an object' using errcode = '22023';
  end if;
  if p_kind = 'vocab' then
    v_data := v_data - 'srs';
  end if;
  -- Reject prototype-sensitive property names, including nested JSON objects.
  if exists (
    with recursive nodes(value) as (
      select v_data
      union all
      select child.value from nodes n cross join lateral (
        select value from jsonb_each(
          case when jsonb_typeof(n.value) = 'object' then n.value else '{}'::jsonb end)
        union all
        select value from jsonb_array_elements(
          case when jsonb_typeof(n.value) = 'array' then n.value else '[]'::jsonb end)
      ) child
    )
    select 1 from nodes n cross join lateral jsonb_object_keys(
      case when jsonb_typeof(n.value) = 'object' then n.value else '{}'::jsonb end
    ) k(key) where k.key in ('__proto__', 'constructor', 'prototype')
  ) then
    raise exception 'Forbidden record property' using errcode = '22023';
  end if;
  if p_kind = 'vocab' then
    if (p_complete or v_data ? 'word')
       and jsonb_typeof(v_data->'word') is distinct from 'string' then
      raise exception 'Vocabulary word must be a string' using errcode = '22023';
    end if;
    if p_complete or v_data ? 'collections' then
      if jsonb_typeof(v_data->'collections') is distinct from 'array' then
        raise exception 'Vocabulary collections must be an array' using errcode = '22023';
      end if;
      if exists (select 1 from jsonb_array_elements(v_data->'collections') a(value)
                 where jsonb_typeof(a.value) <> 'string') then
        raise exception 'Vocabulary collection IDs must be strings' using errcode = '22023';
      end if;
    end if;
    foreach v_field in array array[
      'phonetic', 'translation', 'definition', 'context', 'url', 'lang',
      'language', 'source', 'note', 'notes'
    ] loop
      if v_data ? v_field and jsonb_typeof(v_data->v_field) not in ('string', 'null') then
        raise exception 'Vocabulary text field % must be a string or null', v_field
          using errcode = '22023';
      end if;
    end loop;
  else
    if (p_complete or v_data ? 'id')
       and (jsonb_typeof(v_data->'id') is distinct from 'string'
            or v_data->>'id' is distinct from p_key) then
      raise exception 'Collection ID must match its key' using errcode = '22023';
    end if;
    if (p_complete or v_data ? 'name')
       and jsonb_typeof(v_data->'name') is distinct from 'string' then
      raise exception 'Collection name must be a string' using errcode = '22023';
    end if;
  end if;
  return v_data;
end;
$$;

create or replace function public.create_notebook(p_name text)
returns uuid language plpgsql security definer set search_path = pg_catalog as $$
declare v_id uuid; v_email text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_name is null or length(btrim(p_name)) not between 1 and 200 then
    raise exception 'Notebook name must contain 1 to 200 characters' using errcode = '22023';
  end if;
  select notebook_private.email(email) into v_email from auth.users where id = auth.uid();
  if not found then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  insert into notebook_private.notebooks(name, owner_id)
    values (btrim(p_name), auth.uid()) returning id into v_id;
  insert into notebook_private.members(group_id, user_id, email)
    values (v_id, auth.uid(), v_email);
  return v_id;
end;
$$;

create or replace function public.invite_notebook_member(p_group uuid, p_email text)
returns void language plpgsql security definer set search_path = pg_catalog as $$
declare v_email text;
begin
  perform notebook_private.lock_group(p_group, true);
  v_email := notebook_private.email(p_email);
  insert into notebook_private.invitations(group_id, email)
    values (p_group, v_email) on conflict do nothing;
end;
$$;

create or replace function public.join_notebook(p_group uuid)
returns uuid language plpgsql security definer set search_path = pg_catalog as $$
declare v_email text; v_verified timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  perform 1 from notebook_private.notebooks where id = p_group for update;
  if not found then
    raise exception 'Notebook access denied' using errcode = '42501';
  end if;
  if exists (
    select 1 from notebook_private.members
    where group_id = p_group and user_id = auth.uid()
  ) then
    return p_group;
  end if;
  select lower(btrim(email)), email_confirmed_at into v_email, v_verified
    from auth.users where id = auth.uid();
  if v_verified is null or not exists (
    select 1 from notebook_private.invitations where group_id = p_group and email = v_email
  ) then
    raise exception 'A verified email and matching invitation are required' using errcode = '42501';
  end if;
  insert into notebook_private.members(group_id, user_id, email)
    values (p_group, auth.uid(), v_email)
    on conflict (group_id, user_id) do update set email = excluded.email;
  return p_group;
end;
$$;

create or replace function public.list_notebooks()
returns table(id uuid, name text, owner boolean)
language plpgsql security definer set search_path = pg_catalog as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  return query select n.id, n.name, n.owner_id = auth.uid()
    from notebook_private.notebooks n join notebook_private.members m on m.group_id = n.id
    where m.user_id = auth.uid() order by n.name, n.id;
end;
$$;

create or replace function public.revoke_notebook_member(p_group uuid, p_email text)
returns void language plpgsql security definer set search_path = pg_catalog as $$
declare v_email text;
begin
  perform notebook_private.lock_group(p_group, true);
  v_email := notebook_private.email(p_email);
  if exists (
    select 1 from notebook_private.notebooks n
    join auth.users u on u.id = n.owner_id
    where n.id = p_group and lower(btrim(u.email)) = v_email
  ) or exists (
    select 1 from notebook_private.members m join notebook_private.notebooks n
      on n.id = m.group_id and n.owner_id = m.user_id
    where m.group_id = p_group and m.email = v_email
  ) then
    raise exception 'Cannot revoke the notebook owner' using errcode = '22023';
  end if;
  delete from notebook_private.invitations where group_id = p_group and email = v_email;
  delete from notebook_private.members where group_id = p_group and email = v_email;
end;
$$;

create or replace function public.sync_notebook(p_group uuid, p_client uuid, p_operations jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  v_records jsonb; v_ack bigint; v_previous bigint := 0; v_sequence numeric;
  v_op jsonb; v_kind text; v_key text; v_record_key text;
  v_old jsonb; v_data jsonb; v_fields jsonb; v_entry jsonb;
begin
  perform notebook_private.lock_group(p_group);
  if p_client is null or jsonb_typeof(p_operations) is distinct from 'array' then
    raise exception 'Client UUID and operations array are required' using errcode = '22023';
  end if;
  if jsonb_array_length(p_operations) > 1000
     or octet_length(p_operations::text) > 4194304 then
    raise exception 'Operation batch exceeds its limit' using errcode = '22023';
  end if;
  select records into v_records from notebook_private.notebooks where id = p_group;
  insert into notebook_private.clients(group_id, user_id, client_id)
    values (p_group, auth.uid(), p_client) on conflict do nothing;
  select ack into v_ack from notebook_private.clients
    where group_id = p_group and user_id = auth.uid() and client_id = p_client;
  for v_op in select value from jsonb_array_elements(p_operations) loop
    if jsonb_typeof(v_op) is distinct from 'object'
       or jsonb_typeof(v_op->'kind') is distinct from 'string'
       or v_op->>'kind' not in ('vocab', 'collections')
       or jsonb_typeof(v_op->'key') is distinct from 'string'
       or v_op->>'key' in ('__proto__', 'constructor', 'prototype')
       or jsonb_typeof(v_op->'deleted') is distinct from 'boolean'
       or jsonb_typeof(v_op->'fields') is distinct from 'object'
       or jsonb_typeof(v_op->'sequence') is distinct from 'number'
       or (v_op ? 'seed' and jsonb_typeof(v_op->'seed') <> 'boolean')
       or (v_op ? 'entry' and jsonb_typeof(v_op->'entry') <> 'object') then
      raise exception 'Invalid operation' using errcode = '22023';
    end if;
    v_sequence := (v_op->>'sequence')::numeric;
    if v_sequence < 1 or v_sequence > 9007199254740991
       or v_sequence <> trunc(v_sequence) or v_sequence <= v_previous then
      raise exception 'Sequences must be increasing positive safe integers' using errcode = '22023';
    end if;
    v_previous := v_sequence::bigint;
    v_kind := v_op->>'kind';
    v_key := v_op->>'key';
    v_fields := notebook_private.validate_record(v_kind, v_key, v_op->'fields', false);
    v_entry := case when v_op ? 'entry'
      then notebook_private.validate_record(v_kind, v_key, v_op->'entry', false)
      else '{}'::jsonb end;
    if v_sequence <= v_ack then
      continue;
    end if;
    -- Compact array JSON matches JavaScript JSON.stringify([kind, key]).
    v_record_key := '[' || to_json(v_kind)::text || ',' || to_json(v_key)::text || ']';
    v_old := v_records->v_record_key;
    if not coalesce((v_op->>'seed')::boolean, false) or v_old is null then
      if (v_op->>'deleted')::boolean then
        v_data := '{}'::jsonb;
      else
        v_data := case when v_old is null or (v_old->>'deleted')::boolean
          then v_entry else v_old->'data' end;
        v_data := notebook_private.validate_record(v_kind, v_key, v_data || v_fields, true);
      end if;
      v_records := v_records || jsonb_build_object(v_record_key,
        jsonb_build_object('kind', v_kind, 'key', v_key,
                          'deleted', (v_op->>'deleted')::boolean, 'data', v_data));
    end if;
    v_ack := v_sequence::bigint;
  end loop;
  if octet_length(v_records::text) > 4194304 then
    raise exception 'Notebook document exceeds 4 MB' using errcode = '22023';
  end if;
  update notebook_private.notebooks set records = v_records where id = p_group;
  update notebook_private.clients set ack = v_ack
    where group_id = p_group and user_id = auth.uid() and client_id = p_client;
  return jsonb_build_object('groupId', p_group, 'records', v_records, 'ack', v_ack);
end;
$$;

revoke all on all functions in schema notebook_private from public, anon, authenticated;
revoke all on function public.create_notebook(text) from public, anon;
revoke all on function public.invite_notebook_member(uuid, text) from public, anon;
revoke all on function public.join_notebook(uuid) from public, anon;
revoke all on function public.list_notebooks() from public, anon;
revoke all on function public.revoke_notebook_member(uuid, text) from public, anon;
revoke all on function public.sync_notebook(uuid, uuid, jsonb) from public, anon;
grant execute on function public.create_notebook(text) to authenticated;
grant execute on function public.invite_notebook_member(uuid, text) to authenticated;
grant execute on function public.join_notebook(uuid) to authenticated;
grant execute on function public.list_notebooks() to authenticated;
grant execute on function public.revoke_notebook_member(uuid, text) to authenticated;
grant execute on function public.sync_notebook(uuid, uuid, jsonb) to authenticated;

commit;
