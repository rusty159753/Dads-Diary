-- Create diary_entries table
create table diary_entries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  content text not null,
  created_at timestamptz default now() not null
);

-- Enable RLS
alter table diary_entries enable row level security;

-- Policies for user-owned entries
create policy 'Users view own entries' on diary_entries for select using (auth.uid() = user_id);
create policy 'Users insert own entries' on diary_entries for insert with check (auth.uid() = user_id);
