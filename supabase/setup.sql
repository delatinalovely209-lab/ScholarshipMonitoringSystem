create extension if not exists pgcrypto;

create table if not exists public.profiles (
    id uuid primary key default gen_random_uuid(),
    full_name text not null,
    email text unique,
    created_at timestamptz not null default now()
);

create table if not exists public.scholarship_programs (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    created_at timestamptz not null default now()
);

create table if not exists public.scholarship_policy_rules (
    program_name text primary key references public.scholarship_programs(name) on update cascade on delete cascade,
    max_gwa numeric(3, 2) not null check (max_gwa >= 1 and max_gwa <= 5),
    min_units integer not null check (min_units >= 0),
    max_failed integer not null default 0 check (max_failed >= 0),
    max_inc integer not null default 0 check (max_inc >= 0),
    max_dropped integer not null default 0 check (max_dropped >= 0),
    updated_at timestamptz not null default now()
);

create table if not exists public.student_records (
    id uuid primary key default gen_random_uuid(),
    student_id_number text not null unique,
    profile_id uuid not null references public.profiles(id) on delete restrict,
    scholarship_program_id uuid references public.scholarship_programs(id) on delete restrict,
    registration_status text not null default 'Pending'
        check (registration_status in ('Pending', 'Confirmed', 'Rejected')),
    reviewed_at timestamptz,
    review_remarks text not null default '',
    created_at timestamptz not null default now()
);

create table if not exists public.submissions (
    id uuid primary key default gen_random_uuid(),
    student_id uuid not null references public.student_records(id) on delete cascade,
    academic_term text not null,
    gwa numeric(3, 2) not null check (gwa >= 1.00 and gwa <= 5.00),
    enrolled_units integer not null check (enrolled_units > 0),
    failed_subjects integer not null default 0 check (failed_subjects >= 0),
    inc_grades integer not null default 0 check (inc_grades >= 0),
    dropped_subjects integer not null default 0 check (dropped_subjects >= 0),
    doc_reference text not null default '',
    submitted_at timestamptz not null default now(),
    verification_status text not null default 'Pending'
        check (verification_status in ('Pending', 'Verified', 'Returned')),
    compliance_status text not null default 'Pending Evaluation'
        check (compliance_status in ('Pending Evaluation', 'Compliant', 'With Deficiency')),
    renewal_decision text not null default 'Pending Decision'
        check (renewal_decision in ('Pending Decision', 'Approved', 'Held', 'Returned')),
    remarks text not null default '',
    created_at timestamptz not null default now()
);

alter table public.student_records
    alter column scholarship_program_id drop not null,
    add column if not exists registration_status text not null default 'Pending',
    add column if not exists reviewed_at timestamptz,
    add column if not exists review_remarks text not null default '';

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'student_records_registration_status_check'
          and conrelid = 'public.student_records'::regclass
    ) then
        alter table public.student_records
            add constraint student_records_registration_status_check
            check (registration_status in ('Pending', 'Confirmed', 'Rejected'));
    end if;
end;
$$;

update public.student_records
set registration_status = 'Confirmed'
where scholarship_program_id is not null
  and registration_status = 'Pending';

create index if not exists submissions_student_id_idx
    on public.submissions(student_id);

insert into public.scholarship_programs (id, name)
values
    ('10000000-0000-4000-8000-000000000001', 'Merit Scholar'),
    ('10000000-0000-4000-8000-000000000002', 'Community Scholar')
on conflict (id) do update
set name = excluded.name;

insert into public.scholarship_policy_rules (
    program_name,
    max_gwa,
    min_units,
    max_failed,
    max_inc,
    max_dropped
)
values
    ('Merit Scholar', 1.75, 18, 0, 0, 0),
    ('Community Scholar', 2.25, 15, 0, 0, 1)
on conflict (program_name) do nothing;

insert into public.profiles (id, full_name, email)
values
    ('20000000-0000-4000-8000-000000000001', 'Jane Doe', 'jane.doe@example.edu'),
    ('20000000-0000-4000-8000-000000000002', 'Mark Santos', 'mark.santos@example.edu'),
    ('20000000-0000-4000-8000-000000000003', 'Maria Cruz', 'maria.cruz@example.edu'),
    ('20000000-0000-4000-8000-000000000004', 'Alex Reyes', 'alex.reyes@example.edu')
on conflict (id) do update
set full_name = excluded.full_name,
    email = excluded.email;

insert into public.student_records (id, student_id_number, profile_id, scholarship_program_id, registration_status)
values
    ('30000000-0000-4000-8000-000000000001', '2024-00129', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Confirmed'),
    ('30000000-0000-4000-8000-000000000002', '2024-00215', '20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Confirmed'),
    ('30000000-0000-4000-8000-000000000003', '2024-00388', '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', 'Confirmed'),
    ('30000000-0000-4000-8000-000000000004', '2024-00401', '20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', 'Confirmed')
on conflict (id) do update
set student_id_number = excluded.student_id_number,
    profile_id = excluded.profile_id,
    scholarship_program_id = excluded.scholarship_program_id;

insert into public.submissions (
    id,
    student_id,
    academic_term,
    gwa,
    enrolled_units,
    failed_subjects,
    inc_grades,
    dropped_subjects,
    doc_reference,
    submitted_at,
    verification_status,
    compliance_status,
    renewal_decision,
    remarks
)
values
    ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '1st Semester 2026-2027', 1.50, 18, 0, 0, 0, 'https://drive.google.com/file/d/janedoe_grades', '2026-10-25T14:30:00+08:00', 'Verified', 'Compliant', 'Approved', 'All criteria satisfied.'),
    ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', '1st Semester 2026-2027', 1.85, 18, 0, 0, 0, 'https://drive.google.com/file/d/marksantos_grades', '2026-10-28T09:15:00+08:00', 'Verified', 'With Deficiency', 'Held', 'GWA exceeds 1.75 limit for Merit program.'),
    ('40000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000003', '1st Semester 2026-2027', 2.10, 15, 0, 0, 1, 'https://drive.google.com/file/d/mariacruz_grades', '2026-10-30T16:50:00+08:00', 'Pending', 'Pending Evaluation', 'Pending Decision', ''),
    ('40000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000004', '1st Semester 2026-2027', 2.50, 14, 1, 0, 2, 'https://drive.google.com/file/d/alexreyes_grades', '2026-10-31T08:20:00+08:00', 'Pending', 'Pending Evaluation', 'Pending Decision', '')
on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.scholarship_programs enable row level security;
alter table public.scholarship_policy_rules enable row level security;
alter table public.student_records enable row level security;
alter table public.submissions enable row level security;

drop policy if exists "Demo public read profiles" on public.profiles;
create policy "Demo public read profiles"
    on public.profiles for select to anon, authenticated
    using (true);

drop policy if exists "Demo public read scholarship programs" on public.scholarship_programs;
create policy "Demo public read scholarship programs"
    on public.scholarship_programs for select to anon, authenticated
    using (true);

drop policy if exists "Demo public read scholarship policy rules" on public.scholarship_policy_rules;
create policy "Demo public read scholarship policy rules"
    on public.scholarship_policy_rules for select to anon, authenticated
    using (true);

drop policy if exists "Demo public insert scholarship policy rules" on public.scholarship_policy_rules;
create policy "Demo public insert scholarship policy rules"
    on public.scholarship_policy_rules for insert to anon, authenticated
    with check (true);

drop policy if exists "Demo public update scholarship policy rules" on public.scholarship_policy_rules;
create policy "Demo public update scholarship policy rules"
    on public.scholarship_policy_rules for update to anon, authenticated
    using (true)
    with check (true);

drop policy if exists "Demo public read student records" on public.student_records;
create policy "Demo public read student records"
    on public.student_records for select to anon, authenticated
    using (true);

drop policy if exists "Demo public read submissions" on public.submissions;
create policy "Demo public read submissions"
    on public.submissions for select to anon, authenticated
    using (true);

drop policy if exists "Demo public insert submissions" on public.submissions;
create policy "Demo public insert submissions"
    on public.submissions for insert to anon, authenticated
    with check (
        exists (
            select 1
            from public.student_records sr
            where sr.id = student_id
              and sr.registration_status = 'Confirmed'
        )
    );

drop policy if exists "Demo public update submissions" on public.submissions;
create policy "Demo public update submissions"
    on public.submissions for update to anon, authenticated
    using (true)
    with check (true);

grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.scholarship_programs, public.scholarship_policy_rules, public.student_records, public.submissions to anon, authenticated;
grant insert, update on public.submissions to anon, authenticated;
grant insert, update on public.scholarship_policy_rules to anon, authenticated;

do $$
begin
    if exists (
        select 1
        from pg_publication
        where pubname = 'supabase_realtime'
    ) and not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'scholarship_policy_rules'
    ) then
        alter publication supabase_realtime
            add table public.scholarship_policy_rules;
    end if;
end;
$$;

create or replace function public.create_student_record(
    p_email text,
    p_full_name text,
    p_program_name text,
    p_student_id_number text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_profile_id uuid;
    v_student_record_id uuid;
begin
    if nullif(trim(p_student_id_number), '') is null
        or nullif(trim(p_full_name), '') is null then
        raise exception 'Student ID and full name are required.';
    end if;

    insert into public.profiles (full_name, email)
    values (trim(p_full_name), nullif(lower(trim(p_email)), ''))
    returning id into v_profile_id;

    insert into public.student_records (student_id_number, profile_id, scholarship_program_id, registration_status)
    values (trim(p_student_id_number), v_profile_id, null, 'Pending')
    returning id into v_student_record_id;

    return v_student_record_id;
end;
$$;

revoke all on function public.create_student_record(text, text, text, text) from public;
grant execute on function public.create_student_record(text, text, text, text) to anon, authenticated;

create or replace function public.confirm_student_registration(
    p_student_record_id uuid,
    p_program_name text,
    p_review_remarks text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_program_id uuid;
begin
    select id into v_program_id
    from public.scholarship_programs
    where name = p_program_name;

    if v_program_id is null then
        raise exception 'Scholarship program does not exist.';
    end if;

    update public.student_records
    set scholarship_program_id = v_program_id,
        registration_status = 'Confirmed',
        reviewed_at = now(),
        review_remarks = coalesce(nullif(trim(p_review_remarks), ''), 'Student registration confirmed.')
    where id = p_student_record_id
      and registration_status = 'Pending';

    if not found then
        raise exception 'Student registration was not found or is no longer pending.';
    end if;
end;
$$;

create or replace function public.reject_student_registration(
    p_student_record_id uuid,
    p_review_remarks text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    update public.student_records
    set registration_status = 'Rejected',
        reviewed_at = now(),
        review_remarks = coalesce(nullif(trim(p_review_remarks), ''), 'Student registration rejected.')
    where id = p_student_record_id
      and registration_status = 'Pending';

    if not found then
        raise exception 'Student registration was not found or is no longer pending.';
    end if;
end;
$$;

revoke all on function public.confirm_student_registration(uuid, text, text) from public;
revoke all on function public.reject_student_registration(uuid, text) from public;
grant execute on function public.confirm_student_registration(uuid, text, text) to anon, authenticated;
grant execute on function public.reject_student_registration(uuid, text) to anon, authenticated;

select
    sr.student_id_number,
    p.full_name,
    sp.name as scholarship_program,
    s.academic_term,
    s.gwa,
    s.enrolled_units,
    s.verification_status,
    s.compliance_status,
    s.renewal_decision
from public.student_records sr
join public.profiles p on p.id = sr.profile_id
left join public.scholarship_programs sp on sp.id = sr.scholarship_program_id
left join public.submissions s on s.student_id = sr.id
order by sr.student_id_number, s.submitted_at;

notify pgrst, 'reload schema';
