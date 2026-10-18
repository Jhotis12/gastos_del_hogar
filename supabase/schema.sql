-- =============================================================
-- App de Gastos del Hogar — snapshot del esquema (PostgreSQL/Supabase)
--
-- GENERADO desde las migraciones aplicadas en el entorno local
-- (última migración: 20261018120000_wishlist_realtime_hardening).
--
-- LA FUENTE DE VERDAD ES supabase/migrations/. Este archivo es solo un
-- snapshot para instalaciones frescas desde el SQL Editor de Supabase.
-- No re-ejecutar sobre una base existente: CREATE POLICY no es idempotente.
--
-- Para instalar: crear un proyecto Supabase nuevo y ejecutar este archivo
-- completo. Para desarrollo local: `supabase db reset` (aplica migraciones).
-- =============================================================

create extension if not exists "pgcrypto";




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";




COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."apply_recurring_expense"("p_recurring_id" "uuid", "p_month" "date") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  hh uuid := (select household_id from public.profiles where id = auth.uid());
  r record;
  first_day date := date_trunc('month', p_month)::date;
  last_day date := (date_trunc('month', p_month) + interval '1 month' - interval '1 day')::date;
  already_applied boolean;
begin
  if hh is null then
    return 0;
  end if;

  select * into r
  from public.recurring_expenses
  where id = p_recurring_id
    and household_id = hh
    and is_active = true
    and next_due_date <= last_day;

  if r.id is null then
    return 0;
  end if;

  select exists(
    select 1 from public.expenses
    where household_id = hh
      and recurring_id = r.id
      and expense_date >= first_day
      and expense_date <= last_day
  ) into already_applied;

  if already_applied then
    return 0;
  end if;

  insert into public.expenses (household_id, category_id, paid_by, amount, description, expense_date, recurring_id)
  values (hh, r.category_id, r.paid_by, r.amount, r.description, greatest(r.next_due_date, first_day), r.id);

  update public.recurring_expenses
  set next_due_date = case r.frequency
    when 'bimonthly' then (date_trunc('month', p_month) + interval '2 months')::date
    when 'quarterly' then (date_trunc('month', p_month) + interval '3 months')::date
    when 'yearly' then (date_trunc('month', p_month) + interval '1 year')::date
    else (date_trunc('month', p_month) + interval '1 month')::date
  end
  where id = r.id;

  return 1;
end;
$$;




CREATE OR REPLACE FUNCTION "public"."create_household"("p_name" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  new_id uuid := gen_random_uuid();
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Se requiere sesión iniciada';
  end if;

  insert into public.households (id, name, invite_code)
  values (new_id, p_name, public.generate_invite_code());

  update public.profiles
  set household_id = new_id
  where id = uid;

  insert into public.categories (household_id, name, color, icon) values
    (new_id, 'Vivienda', '#6366f1', 'home'),
    (new_id, 'Comida', '#f59e0b', 'utensils'),
    (new_id, 'Transporte', '#10b981', 'car'),
    (new_id, 'Servicios', '#0ea5e9', 'zap'),
    (new_id, 'Salud', '#ef4444', 'heart'),
    (new_id, 'Ocio', '#ec4899', 'gamepad'),
    (new_id, 'Otros', '#8b5cf6', 'tag');

  return new_id;
end;
$$;




CREATE OR REPLACE FUNCTION "public"."generate_invite_code"() RETURNS "text"
    LANGUAGE "sql"
    SET "search_path" TO 'public'
    AS $$
  select upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
$$;




CREATE OR REPLACE FUNCTION "public"."get_household_by_code"("p_code" "text") RETURNS TABLE("id" "uuid", "name" "text", "invite_code" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  uid uuid := auth.uid();
  attempt record;
begin
  if uid is null then
    return;
  end if;

  -- Ventana deslizante de 10 minutos, máximo 10 búsquedas por usuario.
  select * into attempt
  from public.invite_lookup_attempts
  where user_id = uid
  for update;

  if attempt.user_id is null then
    insert into public.invite_lookup_attempts (user_id)
    values (uid);
  elsif attempt.window_start < now() - interval '10 minutes' then
    update public.invite_lookup_attempts
    set attempts = 1, window_start = now()
    where user_id = uid;
  elsif attempt.attempts >= 10 then
    raise exception 'Demasiados intentos de unión. Espera 10 minutos e inténtalo de nuevo.';
  else
    update public.invite_lookup_attempts
    set attempts = attempts + 1
    where user_id = uid;
  end if;

  return query
    select h.id, h.name, h.invite_code
    from public.households h
    where h.invite_code = upper(p_code);
end;
$$;




CREATE OR REPLACE FUNCTION "public"."get_monthly_surpluses"() RETURNS TABLE("month" "date", "income" numeric, "expenses" numeric, "surplus" numeric)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with hh as (
    select household_id from public.profiles where id = auth.uid()
  ),
  members as (
    select id, payday
    from public.profiles
    where household_id = (select household_id from hh)
  ),
  months as (
    select d.month::date as month
    from (
      select least(
               (select min(date_trunc('month', s.pay_date)::date)
                from public.salaries s
                where s.household_id = (select household_id from hh)),
               (select min(date_trunc('month', i.income_date)::date)
                from public.incomes i
                where i.household_id = (select household_id from hh)),
               (select min(date_trunc('month', e.expense_date)::date)
                from public.expenses e
                where e.household_id = (select household_id from hh))
             ) as first_month,
             date_trunc('month', current_date)::date as last_month
    ) r
    cross join generate_series(
      r.first_month::timestamp,
      r.last_month::timestamp,
      interval '1 month'
    ) d(month)
  ),
  sal_eff as (
    -- Fila real (llegada real del dinero): todas las del hogar, incluso de
    -- miembros que ya salieron (el historial no puede perder su aporte).
    select m.month,
           s.profile_id,
           s.amount::numeric as amount,
           s.pay_date::date as pay_date
    from months m
    join public.salaries s
      on s.household_id = (select household_id from hh)
     and s.pay_date >= m.month
     and s.pay_date < (m.month + interval '1 month')::date
    union all
    -- Herencia: miembros ACTUALES sin FILA DEL MES (month = m.month), con
    -- pay_date calculada según su día de pago y solo si tienen historial
    -- previo. Chequear la fila del mes (no el pay_date) evita contar dos
    -- veces una nómina registrada cuyo pay_date cae en otro mes.
    select m.month,
           p.id as profile_id,
           ih.amount::numeric as amount,
           ih.pay_date::date as pay_date
    from months m
    cross join members p
    left join lateral (
      select 1 as present
      from public.salaries s
      where s.household_id = (select household_id from hh)
        and s.profile_id = p.id
        and s.month = m.month
      limit 1
    ) ex on true
    left join lateral (
      select s.amount,
             make_date(
               extract(year from m.month)::int,
               extract(month from m.month)::int,
               least(
                 greatest(p.payday, 1),
                 extract(day from (m.month + interval '1 month' - interval '1 day'))::int
               )
             ) as pay_date
      from public.salaries s
      where s.household_id = (select household_id from hh)
        and s.profile_id = p.id
        and s.month < m.month
      order by s.month desc
      limit 1
    ) ih on true
    where ex.present is null
      and ih.amount is not null
  ),
  salaries as (
    select e.month,
           sum(e.amount)::numeric as total
    from sal_eff e
    where e.pay_date <= least(
      current_date,
      (e.month + interval '1 month' - interval '1 day')::date
    )
    group by e.month
  ),
  incomes as (
    select date_trunc('month', i.income_date)::date as month,
           sum(i.amount)::numeric as total
    from public.incomes i
    join hh on hh.household_id = i.household_id
    group by 1
  ),
  expenses as (
    select date_trunc('month', e.expense_date)::date as month,
           sum(e.amount)::numeric as total
    from public.expenses e
    join hh on hh.household_id = e.household_id
    group by 1
  )
  select m.month::date,
         coalesce(s.total, 0) + coalesce(i.total, 0) as income,
         coalesce(e.total, 0) as expenses,
         coalesce(s.total, 0) + coalesce(i.total, 0) - coalesce(e.total, 0) as surplus
  from months m
  left join salaries s on s.month = m.month
  left join incomes i on i.month = m.month
  left join expenses e on e.month = m.month
  order by m.month
$$;




CREATE OR REPLACE FUNCTION "public"."get_running_balance"("p_date" "date") RETURNS numeric
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select (
    coalesce((
      select sum(s.amount)::numeric
      from public.salaries s
      where s.household_id = (select household_id from public.profiles where id = auth.uid())
        and s.pay_date <= p_date
    ), 0)
    + coalesce((
      select sum(i.amount)::numeric
      from public.incomes i
      where i.household_id = (select household_id from public.profiles where id = auth.uid())
        and i.income_date <= p_date
    ), 0)
    - coalesce((
      select sum(e.amount)::numeric
      from public.expenses e
      where e.household_id = (select household_id from public.profiles where id = auth.uid())
        and e.expense_date <= p_date
    ), 0)
  );
$$;




CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;




CREATE OR REPLACE FUNCTION "public"."is_household_member"("check_household" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.household_id = check_household
  );
$$;



SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "household_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "color" "text" DEFAULT '#6366f1'::"text" NOT NULL,
    "icon" "text" DEFAULT 'tag'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);




CREATE TABLE IF NOT EXISTS "public"."category_budgets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "household_id" "uuid" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "month" "date" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "category_budgets_amount_check" CHECK (("amount" > (0)::numeric))
);




CREATE TABLE IF NOT EXISTS "public"."expenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "household_id" "uuid" NOT NULL,
    "category_id" "uuid",
    "paid_by" "uuid",
    "recurring_id" "uuid",
    "amount" numeric(12,2) NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "expense_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "splits" "uuid"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "receipt_id" "uuid",
    CONSTRAINT "expenses_amount_check" CHECK (("amount" > (0)::numeric))
);




CREATE TABLE IF NOT EXISTS "public"."households" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "invite_code" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);




CREATE TABLE IF NOT EXISTS "public"."incomes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "household_id" "uuid" NOT NULL,
    "member_id" "uuid",
    "amount" numeric(12,2) NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "income_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "incomes_amount_check" CHECK (("amount" > (0)::numeric))
);




CREATE TABLE IF NOT EXISTS "public"."invite_lookup_attempts" (
    "user_id" "uuid" NOT NULL,
    "attempts" integer DEFAULT 1 NOT NULL,
    "window_start" timestamp with time zone DEFAULT "now"() NOT NULL
);




CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "household_id" "uuid",
    "full_name" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "payday" smallint DEFAULT 1 NOT NULL,
    "avatar_path" "text",
    CONSTRAINT "profiles_payday_check" CHECK ((("payday" >= 1) AND ("payday" <= 31)))
);




CREATE TABLE IF NOT EXISTS "public"."receipts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "household_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "uploaded_by" "uuid",
    "parsed_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);




CREATE TABLE IF NOT EXISTS "public"."recurring_expenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "household_id" "uuid" NOT NULL,
    "category_id" "uuid",
    "paid_by" "uuid",
    "amount" numeric(12,2) NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "frequency" "text" DEFAULT 'monthly'::"text" NOT NULL,
    "next_due_date" "date" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "recurring_expenses_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "recurring_expenses_frequency_check" CHECK (("frequency" = ANY (ARRAY['monthly'::"text", 'bimonthly'::"text", 'quarterly'::"text", 'yearly'::"text"])))
);




CREATE TABLE IF NOT EXISTS "public"."salaries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "household_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "month" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "pay_date" "date" DEFAULT ("date_trunc"('month'::"text", (CURRENT_DATE)::timestamp with time zone))::"date" NOT NULL,
    CONSTRAINT "salaries_amount_check" CHECK (("amount" > (0)::numeric))
);




CREATE TABLE IF NOT EXISTS "public"."savings_goals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "household_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "target_amount" numeric(12,2) NOT NULL,
    "saved_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "target_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "savings_goals_saved_amount_check" CHECK (("saved_amount" >= (0)::numeric)),
    CONSTRAINT "savings_goals_target_amount_check" CHECK (("target_amount" > (0)::numeric))
);




CREATE TABLE IF NOT EXISTS "public"."wishlist_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "household_id" "uuid" NOT NULL,
    "created_by" "uuid",
    "name" "text" NOT NULL,
    "price" numeric(12,2) NOT NULL,
    "priority" "text" DEFAULT 'deseo'::"text" NOT NULL,
    "status" "text" DEFAULT 'pendiente'::"text" NOT NULL,
    "payment_method" "text" DEFAULT 'contado'::"text" NOT NULL,
    "installments_count" smallint,
    "interest_rate" numeric(5,2),
    "cutoff_day" smallint,
    "purchase_date" "date",
    "bought_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "initial_payment" numeric(12,2) DEFAULT 0 NOT NULL,
    CONSTRAINT "wishlist_initial_lt_price" CHECK (("initial_payment" <= "price")),
    CONSTRAINT "wishlist_items_cutoff_day_check" CHECK ((("cutoff_day" IS NULL) OR (("cutoff_day" >= 1) AND ("cutoff_day" <= 31)))),
    CONSTRAINT "wishlist_items_initial_payment_check" CHECK (("initial_payment" >= (0)::numeric)),
    CONSTRAINT "wishlist_items_installments_count_check" CHECK ((("installments_count" IS NULL) OR (("installments_count" >= 1) AND ("installments_count" <= 60)))),
    CONSTRAINT "wishlist_items_interest_rate_check" CHECK ((("interest_rate" IS NULL) OR ("interest_rate" >= (0)::numeric))),
    CONSTRAINT "wishlist_items_payment_method_check" CHECK (("payment_method" = ANY (ARRAY['contado'::"text", 'cuotas'::"text"]))),
    CONSTRAINT "wishlist_items_price_check" CHECK (("price" > (0)::numeric)),
    CONSTRAINT "wishlist_items_priority_check" CHECK (("priority" = ANY (ARRAY['necesidad'::"text", 'deseo'::"text", 'regalo'::"text"]))),
    CONSTRAINT "wishlist_items_status_check" CHECK (("status" = ANY (ARRAY['pendiente'::"text", 'comprado'::"text", 'descartado'::"text"])))
);




ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."category_budgets"
    ADD CONSTRAINT "category_budgets_category_id_month_key" UNIQUE ("category_id", "month");



ALTER TABLE ONLY "public"."category_budgets"
    ADD CONSTRAINT "category_budgets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."households"
    ADD CONSTRAINT "households_invite_code_key" UNIQUE ("invite_code");



ALTER TABLE ONLY "public"."households"
    ADD CONSTRAINT "households_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."incomes"
    ADD CONSTRAINT "incomes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invite_lookup_attempts"
    ADD CONSTRAINT "invite_lookup_attempts_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."receipts"
    ADD CONSTRAINT "receipts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recurring_expenses"
    ADD CONSTRAINT "recurring_expenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."salaries"
    ADD CONSTRAINT "salaries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."salaries"
    ADD CONSTRAINT "salaries_profile_id_month_key" UNIQUE ("profile_id", "month");



ALTER TABLE ONLY "public"."savings_goals"
    ADD CONSTRAINT "savings_goals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wishlist_items"
    ADD CONSTRAINT "wishlist_items_pkey" PRIMARY KEY ("id");



CREATE INDEX "budgets_household_month_idx" ON "public"."category_budgets" USING "btree" ("household_id", "month");



CREATE INDEX "categories_household_idx" ON "public"."categories" USING "btree" ("household_id");



CREATE INDEX "expenses_household_date_idx" ON "public"."expenses" USING "btree" ("household_id", "expense_date");



CREATE INDEX "expenses_recurring_idx" ON "public"."expenses" USING "btree" ("recurring_id");



CREATE INDEX "incomes_household_date_idx" ON "public"."incomes" USING "btree" ("household_id", "income_date");



CREATE INDEX "recurring_household_due_idx" ON "public"."recurring_expenses" USING "btree" ("household_id", "next_due_date");



CREATE INDEX "salaries_household_month_idx" ON "public"."salaries" USING "btree" ("household_id", "month");



CREATE INDEX "salaries_household_paydate_idx" ON "public"."salaries" USING "btree" ("household_id", "pay_date");



CREATE INDEX "savings_household_idx" ON "public"."savings_goals" USING "btree" ("household_id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."category_budgets"
    ADD CONSTRAINT "category_budgets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."category_budgets"
    ADD CONSTRAINT "category_budgets_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_paid_by_fkey" FOREIGN KEY ("paid_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "public"."receipts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_recurring_id_fkey" FOREIGN KEY ("recurring_id") REFERENCES "public"."recurring_expenses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."incomes"
    ADD CONSTRAINT "incomes_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."incomes"
    ADD CONSTRAINT "incomes_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invite_lookup_attempts"
    ADD CONSTRAINT "invite_lookup_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."receipts"
    ADD CONSTRAINT "receipts_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."receipts"
    ADD CONSTRAINT "receipts_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."recurring_expenses"
    ADD CONSTRAINT "recurring_expenses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."recurring_expenses"
    ADD CONSTRAINT "recurring_expenses_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recurring_expenses"
    ADD CONSTRAINT "recurring_expenses_paid_by_fkey" FOREIGN KEY ("paid_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."salaries"
    ADD CONSTRAINT "salaries_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."salaries"
    ADD CONSTRAINT "salaries_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."savings_goals"
    ADD CONSTRAINT "savings_goals_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wishlist_items"
    ADD CONSTRAINT "wishlist_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wishlist_items"
    ADD CONSTRAINT "wishlist_items_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



CREATE POLICY "budgets: crear del hogar" ON "public"."category_budgets" FOR INSERT WITH CHECK ("public"."is_household_member"("household_id"));



CREATE POLICY "budgets: editar del hogar" ON "public"."category_budgets" FOR UPDATE USING ("public"."is_household_member"("household_id")) WITH CHECK ("public"."is_household_member"("household_id"));



CREATE POLICY "budgets: eliminar del hogar" ON "public"."category_budgets" FOR DELETE USING ("public"."is_household_member"("household_id"));



CREATE POLICY "budgets: ver del hogar" ON "public"."category_budgets" FOR SELECT USING ("public"."is_household_member"("household_id"));



ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "categories: crear del hogar" ON "public"."categories" FOR INSERT WITH CHECK ("public"."is_household_member"("household_id"));



CREATE POLICY "categories: editar del hogar" ON "public"."categories" FOR UPDATE USING ("public"."is_household_member"("household_id")) WITH CHECK ("public"."is_household_member"("household_id"));



CREATE POLICY "categories: eliminar del hogar" ON "public"."categories" FOR DELETE USING ("public"."is_household_member"("household_id"));



CREATE POLICY "categories: ver del hogar" ON "public"."categories" FOR SELECT USING ("public"."is_household_member"("household_id"));



ALTER TABLE "public"."category_budgets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."expenses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "expenses: crear del hogar" ON "public"."expenses" FOR INSERT WITH CHECK ("public"."is_household_member"("household_id"));



CREATE POLICY "expenses: editar del hogar" ON "public"."expenses" FOR UPDATE USING ("public"."is_household_member"("household_id")) WITH CHECK ("public"."is_household_member"("household_id"));



CREATE POLICY "expenses: eliminar del hogar" ON "public"."expenses" FOR DELETE USING ("public"."is_household_member"("household_id"));



CREATE POLICY "expenses: ver del hogar" ON "public"."expenses" FOR SELECT USING ("public"."is_household_member"("household_id"));



ALTER TABLE "public"."households" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "households: crear hogar" ON "public"."households" FOR INSERT WITH CHECK (true);



CREATE POLICY "households: editar del hogar" ON "public"."households" FOR UPDATE USING ("public"."is_household_member"("id")) WITH CHECK ("public"."is_household_member"("id"));



CREATE POLICY "households: eliminar del hogar" ON "public"."households" FOR DELETE USING ("public"."is_household_member"("id"));



CREATE POLICY "households: ver mi hogar" ON "public"."households" FOR SELECT USING ("public"."is_household_member"("id"));



ALTER TABLE "public"."incomes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "incomes: crear del hogar" ON "public"."incomes" FOR INSERT WITH CHECK ("public"."is_household_member"("household_id"));



CREATE POLICY "incomes: editar del hogar" ON "public"."incomes" FOR UPDATE USING ("public"."is_household_member"("household_id")) WITH CHECK ("public"."is_household_member"("household_id"));



CREATE POLICY "incomes: eliminar del hogar" ON "public"."incomes" FOR DELETE USING ("public"."is_household_member"("household_id"));



CREATE POLICY "incomes: ver del hogar" ON "public"."incomes" FOR SELECT USING ("public"."is_household_member"("household_id"));



ALTER TABLE "public"."invite_lookup_attempts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles: crear propio" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "profiles: editar propio" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "profiles: ver compañeros de hogar" ON "public"."profiles" FOR SELECT USING ("public"."is_household_member"("household_id"));



CREATE POLICY "profiles: ver propio" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



ALTER TABLE "public"."receipts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "receipts: crear del hogar" ON "public"."receipts" FOR INSERT WITH CHECK ("public"."is_household_member"("household_id"));



CREATE POLICY "receipts: editar del hogar" ON "public"."receipts" FOR UPDATE USING ("public"."is_household_member"("household_id")) WITH CHECK ("public"."is_household_member"("household_id"));



CREATE POLICY "receipts: eliminar del hogar" ON "public"."receipts" FOR DELETE USING ("public"."is_household_member"("household_id"));



CREATE POLICY "receipts: ver del hogar" ON "public"."receipts" FOR SELECT USING ("public"."is_household_member"("household_id"));



CREATE POLICY "recurring: crear del hogar" ON "public"."recurring_expenses" FOR INSERT WITH CHECK ("public"."is_household_member"("household_id"));



CREATE POLICY "recurring: editar del hogar" ON "public"."recurring_expenses" FOR UPDATE USING ("public"."is_household_member"("household_id")) WITH CHECK ("public"."is_household_member"("household_id"));



CREATE POLICY "recurring: eliminar del hogar" ON "public"."recurring_expenses" FOR DELETE USING ("public"."is_household_member"("household_id"));



CREATE POLICY "recurring: ver del hogar" ON "public"."recurring_expenses" FOR SELECT USING ("public"."is_household_member"("household_id"));



ALTER TABLE "public"."recurring_expenses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."salaries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "salaries: editar el propio" ON "public"."salaries" FOR UPDATE USING (("profile_id" = "auth"."uid"())) WITH CHECK ((("profile_id" = "auth"."uid"()) AND "public"."is_household_member"("household_id")));



CREATE POLICY "salaries: eliminar el propio" ON "public"."salaries" FOR DELETE USING (("profile_id" = "auth"."uid"()));



CREATE POLICY "salaries: registrar el propio" ON "public"."salaries" FOR INSERT WITH CHECK ((("profile_id" = "auth"."uid"()) AND "public"."is_household_member"("household_id")));



CREATE POLICY "salaries: ver del hogar" ON "public"."salaries" FOR SELECT USING ("public"."is_household_member"("household_id"));



CREATE POLICY "savings: crear del hogar" ON "public"."savings_goals" FOR INSERT WITH CHECK ("public"."is_household_member"("household_id"));



CREATE POLICY "savings: editar del hogar" ON "public"."savings_goals" FOR UPDATE USING ("public"."is_household_member"("household_id")) WITH CHECK ("public"."is_household_member"("household_id"));



CREATE POLICY "savings: eliminar del hogar" ON "public"."savings_goals" FOR DELETE USING ("public"."is_household_member"("household_id"));



CREATE POLICY "savings: ver del hogar" ON "public"."savings_goals" FOR SELECT USING ("public"."is_household_member"("household_id"));



ALTER TABLE "public"."savings_goals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wishlist: crear del hogar" ON "public"."wishlist_items" FOR INSERT WITH CHECK ("public"."is_household_member"("household_id"));



CREATE POLICY "wishlist: editar del hogar" ON "public"."wishlist_items" FOR UPDATE USING ("public"."is_household_member"("household_id")) WITH CHECK ("public"."is_household_member"("household_id"));



CREATE POLICY "wishlist: eliminar del hogar" ON "public"."wishlist_items" FOR DELETE USING ("public"."is_household_member"("household_id"));



CREATE POLICY "wishlist: ver del hogar" ON "public"."wishlist_items" FOR SELECT USING ("public"."is_household_member"("household_id"));



ALTER TABLE "public"."wishlist_items" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."apply_recurring_expense"("p_recurring_id" "uuid", "p_month" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."apply_recurring_expense"("p_recurring_id" "uuid", "p_month" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_recurring_expense"("p_recurring_id" "uuid", "p_month" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_household"("p_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_household"("p_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_household"("p_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_invite_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_invite_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_invite_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_household_by_code"("p_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_household_by_code"("p_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_household_by_code"("p_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_monthly_surpluses"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_monthly_surpluses"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_monthly_surpluses"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_running_balance"("p_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_running_balance"("p_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_running_balance"("p_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_household_member"("check_household" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_household_member"("check_household" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_household_member"("check_household" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON TABLE "public"."category_budgets" TO "anon";
GRANT ALL ON TABLE "public"."category_budgets" TO "authenticated";
GRANT ALL ON TABLE "public"."category_budgets" TO "service_role";



GRANT ALL ON TABLE "public"."expenses" TO "anon";
GRANT ALL ON TABLE "public"."expenses" TO "authenticated";
GRANT ALL ON TABLE "public"."expenses" TO "service_role";



GRANT ALL ON TABLE "public"."households" TO "anon";
GRANT ALL ON TABLE "public"."households" TO "authenticated";
GRANT ALL ON TABLE "public"."households" TO "service_role";



GRANT ALL ON TABLE "public"."incomes" TO "anon";
GRANT ALL ON TABLE "public"."incomes" TO "authenticated";
GRANT ALL ON TABLE "public"."incomes" TO "service_role";



GRANT ALL ON TABLE "public"."invite_lookup_attempts" TO "anon";
GRANT ALL ON TABLE "public"."invite_lookup_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."invite_lookup_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."receipts" TO "anon";
GRANT ALL ON TABLE "public"."receipts" TO "authenticated";
GRANT ALL ON TABLE "public"."receipts" TO "service_role";



GRANT ALL ON TABLE "public"."recurring_expenses" TO "anon";
GRANT ALL ON TABLE "public"."recurring_expenses" TO "authenticated";
GRANT ALL ON TABLE "public"."recurring_expenses" TO "service_role";



GRANT ALL ON TABLE "public"."salaries" TO "anon";
GRANT ALL ON TABLE "public"."salaries" TO "authenticated";
GRANT ALL ON TABLE "public"."salaries" TO "service_role";



GRANT ALL ON TABLE "public"."savings_goals" TO "anon";
GRANT ALL ON TABLE "public"."savings_goals" TO "authenticated";
GRANT ALL ON TABLE "public"."savings_goals" TO "service_role";



GRANT ALL ON TABLE "public"."wishlist_items" TO "anon";
GRANT ALL ON TABLE "public"."wishlist_items" TO "authenticated";
GRANT ALL ON TABLE "public"."wishlist_items" TO "service_role";























-- =============================================================
-- Trigger de auth.users (no forma parte del schema public)
-- Crea el perfil automáticamente al registrarse.
-- =============================================================
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================
-- Storage
-- =============================================================

-- Bucket privado receipts: rutas {household_id}/{uuid}.jpg
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "receipts storage: subir del hogar" on storage.objects;
create policy "receipts storage: subir del hogar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] =
      (select household_id::text from public.profiles where id = auth.uid())
  );

drop policy if exists "receipts storage: leer del hogar" on storage.objects;
create policy "receipts storage: leer del hogar"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] in (
      select household_id::text from public.profiles where id = auth.uid()
    )
  );

-- Bucket público avatars (fotos de perfil, hasta 10 MB)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars: ver" on storage.objects;
create policy "avatars: ver"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'avatars');

drop policy if exists "avatars: subir el propio" on storage.objects;
create policy "avatars: subir el propio"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars: actualizar el propio" on storage.objects;
create policy "avatars: actualizar el propio"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars: eliminar el propio" on storage.objects;
create policy "avatars: eliminar el propio"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- =============================================================
-- Realtime: publicar todas las tablas del hogar
-- =============================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'expenses', 'salaries', 'categories', 'category_budgets',
    'recurring_expenses', 'savings_goals', 'receipts', 'profiles',
    'households', 'incomes', 'wishlist_items'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
