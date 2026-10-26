-- Tables

create table public.homes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null default 'Casa',
  created_at timestamptz not null default now()
);

create table public.home_members (
  home_id uuid not null references public.homes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (home_id, user_id)
);

create table public.lists (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references public.homes (id) on delete cascade,
  name text not null,
  status text not null default 'open' check (status in ('open', 'done')),
  created_at timestamptz not null default now()
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists (id) on delete cascade,
  name text not null,
  category text not null default 'Outros',
  measure_value numeric check (measure_value > 0),
  measure_unit text check (measure_unit in ('g', 'kg', 'ml', 'L', 'un')),
  qty_wanted numeric not null default 1 check (qty_wanted > 0),
  price_estimated numeric(10, 2) check (price_estimated >= 0),
  status text not null default 'pending' check (status in ('pending', 'bought')),
  qty_bought numeric check (qty_bought > 0),
  unit_price numeric(10, 2) check (unit_price >= 0),
  real_measure_value numeric check (real_measure_value > 0),
  real_measure_unit text check (real_measure_unit in ('g', 'kg', 'ml', 'L', 'un')),
  chosen_option_id uuid,
  created_at timestamptz not null default now()
);

create table public.options (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items (id) on delete cascade,
  brand text,
  measure_value numeric check (measure_value > 0),
  measure_unit text check (measure_unit in ('g', 'kg', 'ml', 'L', 'un')),
  price numeric(10, 2) not null check (price >= 0),
  created_at timestamptz not null default now()
);

alter table public.items
  add constraint items_chosen_option_id_fkey
  foreign key (chosen_option_id) references public.options (id) on delete set null;

create index on public.home_members (user_id);
create index on public.lists (home_id);
create index on public.items (list_id);
create index on public.items (chosen_option_id);
create index on public.options (item_id);

-- Access helpers (security definer so RLS checks don't recurse)

create function public.is_home_member(p_home_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.home_members
    where home_id = p_home_id and user_id = auth.uid()
  );
$$;

create function public.can_access_list(p_list_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.lists l
    join public.home_members m on m.home_id = l.home_id
    where l.id = p_list_id and m.user_id = auth.uid()
  );
$$;

create function public.can_access_item(p_item_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.items i
    join public.lists l on l.id = i.list_id
    join public.home_members m on m.home_id = l.home_id
    where i.id = p_item_id and m.user_id = auth.uid()
  );
$$;

-- RPCs

create function public.create_home(p_name text default 'Casa')
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_code text := translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_');
  v_home_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  insert into public.homes (code, name) values (v_code, p_name)
  returning id into v_home_id;

  insert into public.home_members (home_id, user_id) values (v_home_id, auth.uid());

  return v_code;
end;
$$;

create function public.join_home(p_code text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_home_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select id into v_home_id from public.homes where code = p_code;
  if v_home_id is null then
    raise exception 'home not found';
  end if;

  insert into public.home_members (home_id, user_id) values (v_home_id, auth.uid())
  on conflict do nothing;

  return v_home_id;
end;
$$;

revoke execute on function public.is_home_member, public.can_access_list, public.can_access_item,
  public.create_home, public.join_home from public, anon;
grant execute on function public.is_home_member, public.can_access_list, public.can_access_item,
  public.create_home, public.join_home to authenticated;

-- Row level security

alter table public.homes enable row level security;
alter table public.home_members enable row level security;
alter table public.lists enable row level security;
alter table public.items enable row level security;
alter table public.options enable row level security;

revoke all on public.homes, public.home_members, public.lists, public.items, public.options from anon;

-- Homes and memberships change only through the RPCs; members may rename a home
revoke insert, update, delete on public.homes, public.home_members from authenticated;
grant update (name) on public.homes to authenticated;

create policy "members read home" on public.homes
  for select to authenticated using (public.is_home_member(id));
create policy "members rename home" on public.homes
  for update to authenticated using (public.is_home_member(id));

create policy "members read members" on public.home_members
  for select to authenticated using (public.is_home_member(home_id));

create policy "members manage lists" on public.lists
  for all to authenticated
  using (public.is_home_member(home_id))
  with check (public.is_home_member(home_id));

create policy "members manage items" on public.items
  for all to authenticated
  using (public.can_access_list(list_id))
  with check (public.can_access_list(list_id));

create policy "members manage options" on public.options
  for all to authenticated
  using (public.can_access_item(item_id))
  with check (public.can_access_item(item_id));

-- Realtime

alter publication supabase_realtime add table public.lists, public.items, public.options;
