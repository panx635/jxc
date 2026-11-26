-- 0001 应用骨架：账号、会话、单仓、单位、店铺档案。
-- 领域表由后续迁移按模块追加；本迁移只覆盖登录与应用底座所需。

create table app_user (
  id bigserial primary key,
  username text not null unique,
  display_name text not null,
  password_hash text not null,
  role text not null check (role in ('admin', 'clerk')),
  can_view_cost boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  last_login_at timestamptz,
  constraint app_user_admin_can_view_cost check (role <> 'admin' or can_view_cost)
);

create table user_session (
  id bigserial primary key,
  token_hash text not null unique,
  user_id bigint not null references app_user (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create index user_session_user_id_idx on user_session (user_id);
create index user_session_expires_at_idx on user_session (expires_at);

create table warehouse (
  id bigserial primary key,
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table unit (
  id bigserial primary key,
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table shop_profile (
  id smallint primary key default 1 check (id = 1),
  name text not null,
  logo_url text,
  address text,
  phone text,
  updated_at timestamptz not null default now()
);
