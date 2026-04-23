-- ReadTogether Supabase schema initialization
-- Apply this script inside your Supabase project (SQL Editor or supabase db push)

-- Required extensions --------------------------------------------------------
create extension if not exists "pgcrypto";

-- Utility functions ---------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- Core tables ----------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  avatar_color text not null default '#7c3aed',
  timezone text default 'Asia/Shanghai',
  is_self boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists profiles_is_self_unique
  on public.profiles ((is_self))
  where is_self is true;

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  next_session text,
  active_document_id uuid,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text,
  progress text,
  joined_at timestamptz not null default timezone('utc', now()),
  primary key (group_id, profile_id)
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  title text not null,
  preview text,
  page_count integer,
  current_page integer,
  host_profile_id uuid references public.profiles(id) on delete set null,
  storage_path text,
  file_name text,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger documents_set_updated_at
before update on public.documents
for each row
execute function public.set_updated_at();

alter table public.groups
  add constraint if not exists groups_active_document_fk
  foreign key (active_document_id)
  references public.documents(id)
  on delete set null;

create index if not exists documents_group_id_idx
  on public.documents(group_id);

create table if not exists public.document_annotations (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  snippet text not null,
  note text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists document_annotations_document_id_created_at_idx
  on public.document_annotations(document_id, created_at);

create table if not exists public.document_chat_messages (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  content text not null,
  is_system boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists document_chat_messages_document_id_created_at_idx
  on public.document_chat_messages(document_id, created_at);

create table if not exists public.discussions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  title text not null,
  replies integer not null default 0,
  last_reply timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists discussions_group_id_created_at_idx
  on public.discussions(group_id, created_at desc);

create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  created_at timestamptz not null default timezone('utc', now())
);

-- Optional seed --------------------------------------------------------------
insert into public.profiles (id, name, avatar_color, timezone, is_self)
select gen_random_uuid(), '默认用户', '#38bdf8', 'Asia/Shanghai', true
where not exists (
  select 1 from public.profiles where is_self = true
);

-- Enable basic indexes for lookups ------------------------------------------
create index if not exists group_members_profile_idx
  on public.group_members(profile_id);

create index if not exists recommendations_created_at_idx
  on public.recommendations(created_at desc);

-- Row Level Security (disabled by default). Enable & add policies as needed.
-- alter table public.profiles enable row level security;
-- alter table public.groups enable row level security;
-- ...

