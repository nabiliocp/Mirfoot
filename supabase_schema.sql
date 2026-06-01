-- Execute this entire script in your Supabase SQL Editor.
-- Note: It drops existing tables to recreate them with the new schema, 
-- suitable for a fresh setup or overriding previous tests.

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

drop table if exists public.bets;
drop table if exists public.challenges;
drop table if exists public.profiles;

-- 1. Create a table for public user profiles
create table public.profiles (
  id uuid references auth.users not null primary key,
  username text unique not null,
  first_name text,
  last_name text,
  avatar_type text not null default 'emoji', -- 'emoji' or 'jersey'
  avatar_value text not null default '👽',
  points integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up Row Level Security (RLS) for profiles
alter table public.profiles enable row level security;
create policy "Public profiles are viewable by everyone." on public.profiles for select using (true);
-- When users sign up via auth, the trigger will insert.
create policy "Users can update own profile." on public.profiles for update using (auth.uid() = id);

-- 2. Create a table for challenges
create table public.challenges (
  id uuid default gen_random_uuid() primary key,
  competition_id bigint,
  match_id bigint not null,
  match_home_team text,
  match_away_team text,
  match_date timestamp with time zone,
  creator_id uuid references public.profiles(id),
  title text not null,
  rules text,
  point_rules jsonb not null default '{"exact_score": 5, "good_result": 3, "close_score": 1, "first_to_score": 0, "extra_time": 0, "penalties": 0}',
  locked boolean default false,
  resolved boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up Row Level Security (RLS) for challenges
alter table public.challenges enable row level security;
create policy "Challenges are viewable by everyone." on public.challenges for select using (true);
create policy "Authenticated users can create challenges." on public.challenges for insert with check (auth.role() = 'authenticated');
create policy "Creators can update challenges before locked." on public.challenges for update using (auth.uid() = creator_id and locked = false);
create policy "Creators can delete their own challenges." on public.challenges for delete using (auth.uid() = creator_id);

-- 3. Create a table for user bets/pronostics
create table public.bets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  challenge_id uuid references public.challenges(id) not null,
  predictions jsonb not null default '{}',
  points_awarded integer default null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, challenge_id) -- One bet per challenge per user
);

-- Set up Row Level Security (RLS) for bets
alter table public.bets enable row level security;
create policy "Bets are viewable by everyone." on public.bets for select using (true);
create policy "Users can insert their own bets." on public.bets for insert with check (auth.uid() = user_id);
create policy "Users can update their own bets." on public.bets for update using (auth.uid() = user_id);
create policy "Users can delete their own bets." on public.bets for delete using (auth.uid() = user_id);

-- 4. Function to automatically handle new user signups from Supabase Auth
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, first_name, last_name, avatar_type, avatar_value, points)
  values (
    new.id, 
    coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)), 
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    coalesce(new.raw_user_meta_data->>'avatar_type', 'emoji'),
    coalesce(new.raw_user_meta_data->>'avatar_value', '👽'),
    0
  );
  return new;
end;
$$ language plpgsql security definer;

-- 5. Trigger for new user signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 6. Insert some sample mock data (Optional)
-- insert into public.challenges (match_id, title, point_rules) values ...
