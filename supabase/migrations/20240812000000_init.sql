-- ==============================================================================
-- 1. EXTENSIONS & ENUMS
-- ==============================================================================
create extension if not exists "pgcrypto";

create type role_type as enum ('abbot', 'scheduler', 'member');
create type membership_status as enum ('active', 'pending', 'banned');
create type event_kind as enum ('บิณฑบาต', 'งานวัด', 'กิจนิมนต์');
create type event_color as enum ('saffron', 'green', 'blue');

-- ==============================================================================
-- 2. TABLES
-- ==============================================================================

-- ROOMS
create table rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- MEMBERSHIPS
create table memberships (
  user_id uuid references auth.users(id) on delete cascade not null,
  room_id uuid references rooms(id) on delete cascade not null,
  role role_type not null default 'member',
  status membership_status not null default 'active',
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
  person text not null,
  kind event_kind not null,
  color event_color not null,
  assignee_ids text[] default '{}',
  acknowledged_by text[] default '{}',
  created_at timestamptz default now()
);

-- NOTIFICATIONS
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null,
  message text not null,
  read_status boolean default false,
  created_at timestamptz default now()
);

-- ==============================================================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

alter table rooms enable row level security;
alter table memberships enable row level security;
alter table invites enable row level security;
alter table events enable row level security;
alter table notifications enable row level security;

-- Rooms RLS: Anyone can read a room if they are a member
create policy "Members can view their rooms"
  on rooms for select
  using (exists (select 1 from memberships where user_id = auth.uid() and room_id = id));

-- Memberships RLS: 
create policy "Users can view memberships for rooms they belong to"
  on memberships for select
  using (exists (select 1 from memberships m where m.room_id = memberships.room_id and m.user_id = auth.uid()));

create policy "Abbots can update memberships"
  on memberships for update
  using (exists (select 1 from memberships m where m.room_id = memberships.room_id and m.user_id = auth.uid() and m.role = 'abbot'))
  with check (exists (select 1 from memberships m where m.room_id = memberships.room_id and m.user_id = auth.uid() and m.role = 'abbot') and (user_id != auth.uid() or role = 'abbot'));

-- Invites RLS (None: only RPC can read/write them)

-- Events RLS:
create policy "Members can view events in their rooms"
  on events for select
  using (exists (select 1 from memberships where user_id = auth.uid() and room_id = events.room_id));

create policy "Abbots and Schedulers can insert events"
  on events for insert
  with check (exists (select 1 from memberships where user_id = auth.uid() and room_id = events.room_id and role in ('abbot', 'scheduler')));

create policy "Abbots and Schedulers can update events"
  on events for update
  using (exists (select 1 from memberships where user_id = auth.uid() and room_id = events.room_id and role in ('abbot', 'scheduler')))
  with check (exists (select 1 from memberships where user_id = auth.uid() and room_id = events.room_id and role in ('abbot', 'scheduler')));

create policy "Abbots and Schedulers can delete events"
  on events for delete
  using (exists (select 1 from memberships where user_id = auth.uid() and room_id = events.room_id and role in ('abbot', 'scheduler')));

create policy "Members can acknowledge events"
  on events for update
  using (exists (select 1 from memberships where user_id = auth.uid() and room_id = events.room_id and role = 'member'))
  with check (
    -- Only allowed to append to acknowledged_by
    title = title and time = time and person = person and kind = kind and color = color and assignee_ids = assignee_ids
  );

-- Notifications RLS:
create policy "Users can manage their own notifications"
  on notifications for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());


-- ==============================================================================
-- 4. RPC FUNCTIONS
-- ==============================================================================

-- Function to create a room and make the creator an abbot, generating an invite code
create or replace function create_room_with_abbot(room_name text)
returns json as $$
declare
  new_room_id uuid;
  plain_invite_code text;
  hashed_invite text;
begin
  -- 1. Create the room
  insert into rooms (name) values (room_name) returning id into new_room_id;
  
  -- 2. Make the current user the abbot
  insert into memberships (user_id, room_id, role, status)
  values (auth.uid(), new_room_id, 'abbot', 'active');
  
  -- 3. Generate a secure random 8-character hex code
  plain_invite_code := encode(gen_random_bytes(4), 'hex');
  hashed_invite := encode(digest(plain_invite_code, 'sha256'), 'hex');
  
  -- 4. Insert into invites
  insert into invites (room_id, invite_code_hash) values (new_room_id, hashed_invite);
  
  -- 5. Return room_id and the plain invite code
  return json_build_object('room_id', new_room_id, 'invite_code', plain_invite_code);
end;
$$ language plpgsql security definer set search_path = public;

-- Function to join a room via an invite code
create or replace function join_room_by_invite(code text)
returns uuid as $$
declare
  hashed_input text;
  target_room_id uuid;
begin
  -- Hash the input code
  hashed_input := encode(digest(code, 'sha256'), 'hex');
  
  -- Find the room id associated with this hash
  select room_id into target_room_id from invites where invite_code_hash = hashed_input limit 1;
  
  if target_room_id is null then
    raise exception 'Invalid invite code';
  end if;
  
  -- Insert membership if not exists
  insert into memberships (user_id, room_id, role, status)
  values (auth.uid(), target_room_id, 'member', 'active')
  on conflict (user_id, room_id) do update set status = 'active';
  
  return target_room_id;
end;
$$ language plpgsql security definer set search_path = public;

-- Function to rotate an invite code (only Abbot can call this)
create or replace function rotate_invite_code(target_room_id uuid)
returns text as $$
declare
  plain_invite_code text;
  hashed_invite text;
  is_abbot boolean;
begin
  -- Check if user is abbot of this room
  select exists(
    select 1 from memberships 
    where user_id = auth.uid() and room_id = target_room_id and role = 'abbot'
  ) into is_abbot;
  
  if not is_abbot then
    raise exception 'Unauthorized. Only the abbot can rotate the invite code.';
  end if;
  
  -- Generate new code
  plain_invite_code := encode(gen_random_bytes(4), 'hex');
  hashed_invite := encode(digest(plain_invite_code, 'sha256'), 'hex');
  
  -- Upsert into invites
  insert into invites (room_id, invite_code_hash)
  values (target_room_id, hashed_invite)
  on conflict (room_id) do update set invite_code_hash = hashed_invite;
  
  return plain_invite_code;
end;
$$ language plpgsql security definer set search_path = public;
