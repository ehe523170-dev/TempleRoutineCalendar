-- Enums
create type event_kind as enum ('chanting', 'alms_round', 'cleaning', 'meditation', 'meeting', 'ceremony', 'other');
create type event_color as enum ('orange', 'yellow', 'red', 'green', 'blue', 'purple', 'gray');
create type role_type as enum ('member', 'scheduler', 'abbot');

-- 1. Profiles Table (All users in the system)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  role role_type default 'member',
  room_nickname text,
  assigned_duty text,
  created_at timestamptz default now()
);

-- 2. Events Table (Temple schedule)
create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  kind event_kind default 'other',
  color event_color default 'orange',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

-- 3. Notifications Table
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  message text not null,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.notifications enable row level security;

-- Profiles Policies
create policy "Anyone can view profiles" on public.profiles for select using (auth.role() = 'authenticated');
create policy "Abbots can update any profile" on public.profiles for update using (
  (select role from public.profiles where id = auth.uid()) = 'abbot'
);

-- Events Policies
create policy "Anyone can view events" on public.events for select using (auth.role() = 'authenticated');
create policy "Admins can insert events" on public.events for insert with check (
  (select role from public.profiles where id = auth.uid()) in ('abbot', 'scheduler')
);
create policy "Admins can update events" on public.events for update using (
  (select role from public.profiles where id = auth.uid()) in ('abbot', 'scheduler')
);
create policy "Admins can delete events" on public.events for delete using (
  (select role from public.profiles where id = auth.uid()) in ('abbot', 'scheduler')
);

-- Notifications Policies
create policy "Users can view own notifications" on public.notifications for select using (auth.uid() = user_id);
create policy "Users can update own notifications" on public.notifications for update using (auth.uid() = user_id);
create policy "System can insert notifications" on public.notifications for insert with check (true);

-- Handle New User Trigger
create or replace function public.handle_new_user() 
returns trigger as $$
declare
  is_first_user boolean;
begin
  select count(*) = 0 into is_first_user from public.profiles;

  insert into public.profiles (id, email, role)
  values (
    new.id, 
    new.email,
    case when is_first_user then 'abbot'::role_type else 'member'::role_type end
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
