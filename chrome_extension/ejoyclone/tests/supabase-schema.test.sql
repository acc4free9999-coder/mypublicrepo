-- Disposable PostgreSQL ONLY: psql -X -v ON_ERROR_STOP=1 -f tests/supabase-schema.test.sql DATABASE
-- Creating auth unconditionally deliberately fails on a real Supabase database.
\set ON_ERROR_STOP on
create schema auth;
create role anon nologin;
create role authenticated nologin;
create table auth.users (
  id uuid primary key,
  email text not null,
  email_confirmed_at timestamptz
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
insert into auth.users values
  ('00000000-0000-0000-0000-000000000001', 'owner@example.com', now()),
  ('00000000-0000-0000-0000-000000000002', 'member@example.com', now()),
  ('00000000-0000-0000-0000-000000000003', 'future@example.com', null),
  ('00000000-0000-0000-0000-000000000004', 'outsider@example.com', now());
\ir ../supabase/schema.sql

begin;
create function public.test_assert(p_ok boolean, p_message text)
returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'FAIL: %', p_message; end if;
end;
$$;
create function public.test_error(p_query text, p_state text)
returns void language plpgsql as $$
declare v_state text;
begin
  begin
    execute p_query;
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
  end;
  perform public.test_assert(v_state = p_state,
    format('Expected SQLSTATE %s, got %s for %s', p_state, coalesce(v_state, 'success'), p_query));
end;
$$;

do $$
declare
  g uuid; other_group uuid;
  client uuid := '10000000-0000-0000-0000-000000000001';
  other_client uuid := '10000000-0000-0000-0000-000000000002';
  r jsonb; operations jsonb; bad jsonb; large_text text;
begin
  set local role anon;
  perform public.test_error('select public.list_notebooks()', '42501');
  perform public.test_error('select public.create_notebook(''test'')', '42501');
  reset role;
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '', true);
  perform public.test_error('select public.list_notebooks()', '42501');
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
  g := public.create_notebook('Shared notebook');
  other_group := public.create_notebook('Other notebook');
  perform public.test_assert(public.join_notebook(g) = g, 'Owner reconnects without an invitation');
  perform public.test_assert((select count(*) = 2 from public.list_notebooks()), 'Owner can create many groups');
  perform public.test_assert((select owner from public.list_notebooks() where id = g), 'Owner flag');
  perform public.test_error('select * from notebook_private.notebooks', '42501');
  perform public.test_error('select * from notebook_private.members', '42501');
  perform public.test_error('select * from notebook_private.invitations', '42501');
  perform public.test_error('update notebook_private.notebooks set name = ''hacked''', '42501');
  perform public.test_error('select notebook_private.lock_group(null)', '42501');
  perform public.invite_notebook_member(g, ' MEMBER@EXAMPLE.COM ');
  perform public.invite_notebook_member(g, 'member@example.com');
  -- An invitation does not require an already registered account.
  perform public.invite_notebook_member(g, 'not-yet-registered@example.com');
  perform public.invite_notebook_member(g, 'future@example.com');

  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', true);
  perform public.test_assert((select count(*) = 0 from public.list_notebooks()), 'No public group discovery');
  perform public.test_error(format('select public.join_notebook(%L)', g), '42501');
  perform public.test_error(format('select public.sync_notebook(%L,%L,''[]'')', g, client), '42501');
  perform public.test_error(format('select public.invite_notebook_member(%L,''outsider@example.com'')', g), '42501');

  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
  perform public.test_error(format('select public.join_notebook(%L)', g), '42501');
  reset role;
  update auth.users set email_confirmed_at = now()
    where id = '00000000-0000-0000-0000-000000000003';
  set local role authenticated;
  perform public.test_assert(public.join_notebook(g) = g, 'Verified future user can join');
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
  perform public.test_assert(public.join_notebook(g) = g, 'Invited user joins');
  perform public.test_assert(public.join_notebook(g) = g, 'Join is idempotent while invited');
  perform public.test_assert((select not owner from public.list_notebooks() where id = g), 'Member flag');
  perform public.test_error(format('select public.invite_notebook_member(%L,''x@example.com'')', g), '42501');
  perform public.test_error(format('select public.revoke_notebook_member(%L,''owner@example.com'')', g), '42501');
  perform public.test_error(format('select public.sync_notebook(%L,%L,''[]'')', other_group, client), '42501');
  r := public.sync_notebook(g, client, '[]');
  perform public.test_assert(r = jsonb_build_object('groupId', g, 'records', '{}'::jsonb, 'ack', 0), 'Initial response');

  operations := '[
    {"kind":"vocab","key":"hello","deleted":false,
     "fields":{"word":"hello","collections":[],"translation":"initial","srs":{"due":123}},"sequence":1,"seed":true},
    {"kind":"collections","key":"c1","deleted":false,"fields":{"id":"c1","name":"First"},"sequence":2}
  ]';
  r := public.sync_notebook(g, client, operations);
  perform public.test_assert(r->>'ack' = '2', 'Ordered batch acknowledgement');
  perform public.test_assert(r->'records' ? '["vocab","hello"]', 'Compact JavaScript record key');
  perform public.test_assert(r#>>array['records','["vocab","hello"]','data','word'] = 'hello', 'Seed full fields without entry');
  perform public.test_assert(not (r#>array['records','["vocab","hello"]','data']) ? 'srs', 'Seed SRS stripped');
  r := public.sync_notebook(g, client, operations);
  perform public.test_assert(r->>'ack' = '2', 'Replay skipped');
  r := public.sync_notebook(g, other_client,
    '[{"kind":"vocab","key":"hello","deleted":false,"fields":{"translation":"second","srs":{"due":999}},"sequence":1}]');
  perform public.test_assert(r#>>array['records','["vocab","hello"]','data','translation'] = 'second', 'Independent client ack');
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
  r := public.sync_notebook(g, client,
    '[{"kind":"vocab","key":"hello","deleted":false,"fields":{"definition":"meaning"},"sequence":1}]');
  perform public.test_assert(r->>'ack' = '1', 'Ack is scoped to authenticated user');
  perform public.test_assert(r#>>array['records','["vocab","hello"]','data','translation'] = 'second', 'Field merge preserves other edits');
  perform public.test_assert(r#>>array['records','["vocab","hello"]','data','definition'] = 'meaning', 'Field merge applies edit');
  perform public.test_assert(not (r#>array['records','["vocab","hello"]','data']) ? 'srs', 'Field SRS stripped');
  r := public.sync_notebook(g, client,
    '[{"kind":"vocab","key":"hello","deleted":false,"fields":{"translation":"seed overwrite"},"sequence":2,"seed":true}]');
  perform public.test_assert(r#>>array['records','["vocab","hello"]','data','translation'] = 'second' and r->>'ack' = '2', 'Existing seed skipped but acked');
  r := public.sync_notebook(g, client,
    '[{"kind":"vocab","key":"hello","deleted":true,"fields":{},"sequence":3},
      {"kind":"vocab","key":"hello","deleted":false,"fields":{"word":"hello","collections":[]},"sequence":4,"seed":true}]');
  perform public.test_assert(r#>>array['records','["vocab","hello"]','deleted'] = 'true'
    and r#>array['records','["vocab","hello"]','data'] = '{}'::jsonb and r->>'ack' = '4', 'Tombstone blocks seed');
  r := public.sync_notebook(g, client,
    '[{"kind":"vocab","key":"hello","deleted":false,"entry":{"word":"hello","collections":[],"translation":"reborn","srs":{"due":123}},
       "fields":{"definition":"restored"},"sequence":5}]');
  perform public.test_assert(r#>>array['records','["vocab","hello"]','data','translation'] = 'reborn'
    and r#>>array['records','["vocab","hello"]','data','definition'] = 'restored', 'Entry then fields resurrects');
  perform public.test_assert(not (r#>array['records','["vocab","hello"]','data']) ? 'srs', 'Entry SRS stripped');
  r := public.sync_notebook(g, client,
    '[{"kind":"vocab","key":"quote\"\\é","deleted":false,"fields":{"word":"special","collections":[]},"sequence":6}]');
  perform public.test_assert(r->'records' ? '["vocab","quote\"\\é"]', 'Escaped and Unicode record keys');

  -- Every rejection rolls back the entire batch and its acknowledgement.
  foreach bad in array array[
    '{"kind":"wrong","key":"x","deleted":false,"fields":{},"sequence":8}'::jsonb,
    '{"kind":"vocab","key":"__proto__","deleted":true,"fields":{},"sequence":8}',
    '{"kind":"vocab","key":"constructor","deleted":true,"fields":{},"sequence":8}',
    '{"kind":"vocab","key":"prototype","deleted":true,"fields":{},"sequence":8}',
    '{"kind":"vocab","key":"x","deleted":false,"fields":{"word":null,"collections":[]},"sequence":8}',
    '{"kind":"vocab","key":"x","deleted":false,"fields":{"word":"x","collections":[1]},"sequence":8}',
    '{"kind":"vocab","key":"x","deleted":false,"fields":{"word":"x","collections":[],"translation":1},"sequence":8}',
    '{"kind":"vocab","key":"x","deleted":false,"fields":{"word":"x","collections":[],"nested":{"constructor":1}},"sequence":8}',
    '{"kind":"collections","key":"x","deleted":false,"fields":{"id":"different","name":"x"},"sequence":8}',
    '{"kind":"collections","key":"x","deleted":false,"fields":{"id":"x","name":null},"sequence":8}',
    '{"kind":"vocab","key":"x","deleted":true,"fields":{},"sequence":0}',
    '{"kind":"vocab","key":"x","deleted":true,"fields":{},"sequence":8.5}',
    '{"kind":"vocab","key":"x","deleted":true,"fields":{},"sequence":9007199254740992}',
    '{"kind":"vocab","key":"x","deleted":true,"fields":{},"sequence":"8"}',
    '{"kind":"vocab","key":"x","deleted":"false","fields":{},"sequence":8}',
    '{"kind":"vocab","key":"x","deleted":true,"fields":{},"entry":null,"sequence":8}',
    '{"kind":"vocab","key":"x","deleted":true,"fields":{},"seed":null,"sequence":8}',
    '{"kind":"vocab","key":"x","deleted":true,"fields":[],"sequence":8}',
    '{"kind":"vocab","key":"x","deleted":true,"fields":{},"sequence":7}'
  ] loop
    operations := jsonb_build_array(
      '{"kind":"vocab","key":"hello","deleted":false,"fields":{"translation":"must rollback"},"sequence":7}'::jsonb, bad);
    perform public.test_error(format('select public.sync_notebook(%L,%L,%L::jsonb)', g, client, operations), '22023');
    perform public.test_assert(public.sync_notebook(g, client, '[]') = r, 'Rejected writes are atomic');
  end loop;
  perform public.test_error(format('select public.sync_notebook(%L,null,''[]'')', g), '22023');
  perform public.test_error(format('select public.sync_notebook(%L,%L,null)', g, client), '22023');
  perform public.test_error(format('select public.sync_notebook(%L,%L,''{}'')', g, client), '22023');
  select jsonb_agg(jsonb_build_object('kind','vocab','key','x','deleted',true,'fields','{}'::jsonb,'sequence',n))
    into operations from generate_series(7,1007) n;
  perform public.test_error(format('select public.sync_notebook(%L,%L,%L::jsonb)', g, client, operations), '22023');
  large_text := repeat('a', 2200000);
  r := public.sync_notebook(g, client, jsonb_build_array(jsonb_build_object(
    'kind','vocab','key','large1','deleted',false,'sequence',7,
    'fields',jsonb_build_object('word','large1','collections','[]'::jsonb,'definition',large_text))));
  operations := jsonb_build_array(jsonb_build_object(
    'kind','vocab','key','large2','deleted',false,'sequence',8,
    'fields',jsonb_build_object('word','large2','collections','[]'::jsonb,'definition',large_text)));
  perform public.test_error(format('select public.sync_notebook(%L,%L,%L::jsonb)', g, client, operations), '22023');
  perform public.test_assert(public.sync_notebook(g, client, '[]') = r, 'Complete document bound is atomic');
  operations := jsonb_build_array(jsonb_build_object(
    'kind','vocab','key','large3','deleted',true,'sequence',8,
    'fields',jsonb_build_object('definition',repeat('a',4194304))));
  perform public.test_error(format('select public.sync_notebook(%L,%L,%L::jsonb)', g, client, operations), '22023');
  perform public.test_error(format('select public.revoke_notebook_member(%L,''OWNER@example.com'')', g), '22023');
  perform public.revoke_notebook_member(g, 'member@example.com');
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
  perform public.test_error(format('select public.join_notebook(%L)', g), '42501');
  perform public.test_error(format('select public.sync_notebook(%L,%L,''[]'')', g, client), '42501');
  perform public.test_assert((select count(*) = 0 from public.list_notebooks()), 'Revoked group hidden');
  reset role;
  perform public.test_assert(
    (select count(*) = 0 from notebook_private.clients
      where group_id = g and user_id = '00000000-0000-0000-0000-000000000002'),
    'Revocation removes user client cursors');
  perform public.test_assert(
    (select bool_and(relrowsecurity) from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'notebook_private' and c.relkind = 'r'), 'RLS enabled on all private tables');
  perform public.test_assert(
    (select bool_and(prosecdef and proconfig @> array['search_path=pg_catalog'])
     from pg_proc where oid in (
       'public.create_notebook(text)'::regprocedure,
       'public.invite_notebook_member(uuid,text)'::regprocedure,
       'public.join_notebook(uuid)'::regprocedure,
       'public.list_notebooks()'::regprocedure,
       'public.revoke_notebook_member(uuid,text)'::regprocedure,
       'public.sync_notebook(uuid,uuid,jsonb)'::regprocedure)), 'RPC definer and fixed search paths');
end;
$$;
rollback;
select 'Supabase notebook SQL acceptance tests passed' as result;
