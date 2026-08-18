-- ==============================================================================
-- 1. EXTENSIONS & ENUMS
-- ==============================================================================
-- Removed pgcrypto dependency to avoid extension issues
create type role_type as enum ('abbot', 'scheduler', 'member');
create type event_kind as enum ('บิณฑบาต', 'งานวัด', 'กิจนิมนต์');
create type event_color as enum ('saffron', 'green', 'blue');

-- ==============================================================================
-- 2. TABLES (Drop old tables if re-running)
-- ==============================================================================
drop table if exists audit_logs cascade;
drop table if exists notifications cascade;
drop table if exists event_acknowledgements cascade;
drop table if exists event_assignees cascade;
drop table if exists events cascade;
drop table if exists invites cascade;
drop table if exists memberships cascade;
drop table if exists rooms cascade;
drop table if exists profiles cascade;

-- PROFILES
create table profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz default now()
);

-- ROOMS
create table rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- MEMBERSHIPS
create table memberships (
  user_id uuid references profiles(id) on delete cascade not null,
  room_id uuid references rooms(id) on delete cascade not null,
  role role_type not null default 'member',
  joined_at timestamptz default now(),
  primary key (user_id, room_id)
);

-- INVITES
create table invites (
  room_id uuid references rooms(id) on delete cascade primary key,
  invite_code_hash text not null,
  created_at timestamptz default now()
);

-- EVENTS
create table events (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade not null,
  day int not null,
  time text not null,
  title text not null,
  kind event_kind not null,
  color event_color not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- EVENT ASSIGNEES (Many to Many)
create table event_assignees (
  event_id uuid references events(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  primary key (event_id, user_id)
);

-- EVENT ACKNOWLEDGEMENTS (Many to Many)
create table event_acknowledgements (
  event_id uuid references events(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  acknowledged_at timestamptz default now(),
  primary key (event_id, user_id)
);

-- NOTIFICATIONS
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  type text not null,
  message text not null,
  read_status boolean default false,
  created_at timestamptz default now()
);

-- AUDIT LOGS
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  actor_id uuid references profiles(id) on delete set null,
  action text not null,
  details jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- ==============================================================================
-- 3. HELPER FUNCTIONS FOR RLS (To prevent infinite recursion)
-- ==============================================================================

create or replace function public.get_my_rooms()
returns setof uuid as $$
  select room_id from memberships where user_id = auth.uid();
$$ language sql security definer set search_path = public;

create or replace function public.is_room_abbot(check_room_id uuid)
returns boolean as $$
  select exists (
    select 1 from memberships where user_id = auth.uid() and room_id = check_room_id and role = 'abbot'
  );
$$ language sql security definer set search_path = public;

create or replace function public.is_room_scheduler(check_room_id uuid)
returns boolean as $$
  select exists (
    select 1 from memberships where user_id = auth.uid() and room_id = check_room_id and role in ('abbot', 'scheduler')
  );
$$ language sql security definer set search_path = public;

-- ==============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

alter table profiles enable row level security;
alter table rooms enable row level security;
alter table memberships enable row level security;
alter table invites enable row level security;
alter table events enable row level security;
alter table event_assignees enable row level security;
alter table event_acknowledgements enable row level security;
alter table notifications enable row level security;
alter table audit_logs enable row level security;

-- PROFILES
create policy "Users can view profiles in their rooms" on profiles for select using (
  id = auth.uid() or id in (
    select user_id from memberships where room_id in (select get_my_rooms())
  )
);
create policy "Users can update their own profile" on profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- ROOMS
create policy "Members can view their rooms" on rooms for select using (
  id in (select get_my_rooms())
);

-- MEMBERSHIPS
create policy "Users can view memberships for their rooms" on memberships for select using (
  room_id in (select get_my_rooms())
);
create policy "Abbots can update memberships" on memberships for update using (
  is_room_abbot(room_id)
) with check (
  is_room_abbot(room_id) and (user_id != auth.uid() or role = 'abbot')
);
create policy "Abbots can delete memberships (kick)" on memberships for delete using (
  is_room_abbot(room_id)
);

-- EVENTS
create policy "Members can view events in their rooms" on events for select using (
  room_id in (select get_my_rooms())
);
create policy "Abbots and Schedulers can insert events" on events for insert with check (
  is_room_scheduler(room_id)
);
create policy "Abbots and Schedulers can update events" on events for update using (
  is_room_scheduler(room_id)
);
create policy "Abbots and Schedulers can delete events" on events for delete using (
  is_room_scheduler(room_id)
);

-- EVENT ASSIGNEES
create policy "Members can view assignees in their rooms" on event_assignees for select using (
  exists (select 1 from events where id = event_assignees.event_id and room_id in (select get_my_rooms()))
);
create policy "Abbots and Schedulers can manage assignees" on event_assignees for all using (
  exists (select 1 from events where id = event_assignees.event_id and is_room_scheduler(room_id))
);

-- EVENT ACKNOWLEDGEMENTS
create policy "Members can view acknowledgements in their rooms" on event_acknowledgements for select using (
  exists (select 1 from events where id = event_acknowledgements.event_id and room_id in (select get_my_rooms()))
);
create policy "Users can acknowledge their assigned events" on event_acknowledgements for insert with check (
  user_id = auth.uid() and
  exists (select 1 from event_assignees ea where ea.event_id = event_id and ea.user_id = auth.uid())
);

-- NOTIFICATIONS
create policy "Users can manage their own notifications" on notifications for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- AUDIT LOGS
create policy "Abbots can view audit logs" on audit_logs for select using (
  is_room_abbot(room_id)
);


-- ==============================================================================
-- 5. RPC FUNCTIONS
-- ==============================================================================

create or replace function create_room(room_name text)
returns json as $$
declare
  new_room_id uuid;
  plain_invite_code text;
  hashed_invite text;
begin
  insert into rooms (name) values (room_name) returning id into new_room_id;
  
  insert into memberships (user_id, room_id, role)
  values (auth.uid(), new_room_id, 'abbot');
  
  plain_invite_code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  hashed_invite := plain_invite_code; -- Bypass hashing to avoid pgcrypto
  
  insert into invites (room_id, invite_code_hash) values (new_room_id, hashed_invite);
  
  insert into audit_logs (room_id, actor_id, action) values (new_room_id, auth.uid(), 'ROOM_CREATED');
  
  return json_build_object('room_id', new_room_id, 'invite_code', plain_invite_code);
end;
$$ language plpgsql security definer set search_path = public, extensions;


create or replace function join_room_by_invite(invite_token text)
returns uuid as $$
declare
  hashed_input text;
  target_room_id uuid;
begin
  hashed_input := invite_token; -- Bypass hashing to avoid pgcrypto
  select room_id into target_room_id from invites where invite_code_hash = hashed_input limit 1;
  
  if target_room_id is null then
    raise exception 'Invalid or revoked invite token';
  end if;
  
  insert into memberships (user_id, room_id, role)
  values (auth.uid(), target_room_id, 'member')
  on conflict (user_id, room_id) do nothing;
  
  insert into audit_logs (room_id, actor_id, action) values (target_room_id, auth.uid(), 'USER_JOINED');
  
  return target_room_id;
end;
$$ language plpgsql security definer set search_path = public, extensions;


create or replace function rotate_room_invite(room_id uuid)
returns text as $$
declare
  plain_invite_code text;
  hashed_invite text;
  is_abbot boolean;
begin
  select exists(
    select 1 from memberships 
    where user_id = auth.uid() and memberships.room_id = rotate_room_invite.room_id and role = 'abbot'
  ) into is_abbot;
  
  if not is_abbot then
    raise exception 'Unauthorized. Only the abbot can rotate the invite token.';
  end if;
  
  plain_invite_code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  hashed_invite := plain_invite_code; -- Bypass hashing to avoid pgcrypto
  
  insert into invites (room_id, invite_code_hash)
  values (rotate_room_invite.room_id, hashed_invite)
  on conflict (room_id) do update set invite_code_hash = hashed_invite;
  
  insert into audit_logs (room_id, actor_id, action) values (rotate_room_invite.room_id, auth.uid(), 'INVITE_ROTATED');
  
  return plain_invite_code;
end;
$$ language plpgsql security definer set search_path = public, extensions;

-- ==============================================================================
-- 5. TRIGGER FOR NEW USERS (Profiles)
-- ==============================================================================
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
