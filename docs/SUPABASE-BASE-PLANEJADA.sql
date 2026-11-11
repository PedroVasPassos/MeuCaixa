-- Referência para a próxima etapa: NÃO é executada pela versão local.
-- Aplicar somente em projeto Supabase configurado após revisão e testes.

create table if not exists public.user_finance_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  opening_date date not null default current_date,
  opening_balance numeric(14,2) not null default 0,
  monthly_salary numeric(14,2) not null default 0 check (monthly_salary >= 0),
  salary_day smallint not null default 5 check (salary_day between 1 and 28),
  monthly_budget numeric(14,2) not null default 0 check (monthly_budget >= 0),
  theme text not null default 'dark' check (theme in ('light','dark'))
);
create table if not exists public.finance_investments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  institution text not null,
  indexer text not null,
  rate numeric(8,3) not null check (rate >= 0),
  started_on date not null,
  initial_amount numeric(14,2) not null check (initial_amount >= 0),
  initial_yield numeric(14,2) not null default 0,
  unique (id,user_id)
);
create table if not exists public.finance_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  investment_id uuid,
  occurred_on date not null,
  title text not null,
  category text not null default 'Outros',
  type text not null check (type in ('receita','despesa','aporte','resgate','rendimento')),
  amount numeric(14,2) not null check (amount > 0),
  direction text not null default 'plus' check (direction in ('plus','minus')),
  foreign key (investment_id,user_id) references public.finance_investments(id,user_id),
  check ((type in ('aporte','resgate','rendimento') and investment_id is not null) or
         (type in ('receita','despesa') and investment_id is null))
);
create index if not exists finance_entries_user_date on public.finance_entries(user_id,occurred_on desc);
create table if not exists public.finance_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target numeric(14,2) not null check (target > 0),
  saved numeric(14,2) not null default 0 check (saved >= 0)
);

alter table public.user_finance_settings enable row level security;
alter table public.finance_investments enable row level security;
alter table public.finance_entries enable row level security;
alter table public.finance_goals enable row level security;

create policy "Own settings" on public.user_finance_settings for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Own investments" on public.finance_investments for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Own entries" on public.finance_entries for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Own goals" on public.finance_goals for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
