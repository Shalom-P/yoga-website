-- 0027_medical_documents.sql
-- Secure medical-document sharing: a customer uploads health documents into a
-- PRIVATE Storage bucket and explicitly shares individual files with a teacher
-- they have booked. Departs deliberately from the public-read media buckets in
-- 0008 — medical records are sensitive personal data (UAE PDPL / India DPDP), so:
--
--   * the bucket is PRIVATE (no public URLs ever); the bytes are reachable only
--     via short-lived signed URLs minted server-side after an authz check.
--   * a customer can only read/write objects inside their OWN {uid}/ folder.
--   * a teacher gets NO direct Storage access — every teacher download is forced
--     through the app's authorization + audit path.
--   * access is least-privilege and revocable: a teacher sees a document only
--     while an explicit, un-revoked share exists, and only for a customer they
--     have actually booked.
--   * admins get NO read access to the documents (PHI minimisation). They can
--     run billing/ops without ever seeing health records.
--   * every download is written to an append-only access log the OWNER can read
--     (transparency) — service-role only writes it.
--
-- Helpers mirror the SECURITY DEFINER pattern from 0001 (is_admin) / 0025
-- (owns_teacher, teacher_owns_booking) so RLS never re-enters itself.
--
-- Depends on 0024/0025 (the 'teacher' role + teachers.profile_id link).
-- After applying, set the bucket's mime/size limits (done below) AND raise the
-- project-wide Storage upload cap in Supabase → Project Settings → Storage if it
-- is below 25 MB, else large uploads 413 (see 0009 note).
-- Apply: psql "$SUPABASE_DB_URL" -f supabase/migrations/0027_medical_documents.sql

-- ── 1. Private Storage bucket ────────────────────────────────────────────────
-- public = false: objects are NOT served by URL; only signed URLs work.
-- allowed_mime_types pins uploads to documents/images; file_size_limit caps size.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'medical-documents',
  'medical-documents',
  false,
  26214400, -- 25 MB
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Storage RLS: a customer may read/insert/delete ONLY inside their own folder,
-- where the first path segment equals their auth uid. No teacher/admin policy —
-- they reach files exclusively through service-role signed URLs in the app.
-- NB: storage.objects already has RLS enabled by Supabase.
drop policy if exists "medical_documents_owner_read" on storage.objects;
create policy "medical_documents_owner_read"
  on storage.objects for select
  using (
    bucket_id = 'medical-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "medical_documents_owner_insert" on storage.objects;
create policy "medical_documents_owner_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'medical-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "medical_documents_owner_delete" on storage.objects;
create policy "medical_documents_owner_delete"
  on storage.objects for delete
  using (
    bucket_id = 'medical-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── 2. Metadata tables (the bytes live in Storage; rows describe + scope them) ─
create table if not exists public.medical_documents (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  note text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists medical_documents_customer_idx
  on public.medical_documents (customer_id) where deleted_at is null;

create table if not exists public.medical_document_shares (
  id uuid primary key default uuid_generate_v4(),
  document_id uuid not null references public.medical_documents(id) on delete cascade,
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  shared_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
-- At most one ACTIVE share per (document, teacher). Revoked rows are kept as history.
create unique index if not exists medical_document_shares_active_uniq
  on public.medical_document_shares (document_id, teacher_id)
  where revoked_at is null;
create index if not exists medical_document_shares_teacher_idx
  on public.medical_document_shares (teacher_id) where revoked_at is null;

create table if not exists public.medical_document_access_log (
  id uuid primary key default uuid_generate_v4(),
  document_id uuid not null references public.medical_documents(id) on delete cascade,
  accessed_by uuid references public.profiles(id) on delete set null,
  accessor_role public.user_role,
  action text not null, -- 'download'
  created_at timestamptz not null default now()
);
create index if not exists medical_document_access_log_document_idx
  on public.medical_document_access_log (document_id, created_at desc);

-- ── 3. SECURITY DEFINER helpers (never re-enter RLS → no recursion) ───────────
-- True when uid owns the (live) document.
create or replace function public.owns_medical_document(uid uuid, doc_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.medical_documents d
    where d.id = doc_id and d.customer_id = uid and d.deleted_at is null
  );
$$;

-- True when uid is the linked account of a teacher who currently has an active
-- share for a LIVE (non-soft-deleted) document. The d.deleted_at guard makes RLS
-- enforce erasure independently of the app's share-revocation step: even if a
-- soft-delete's best-effort revoke ever fails, a tombstoned doc's metadata stops
-- being teacher-readable. Mirrors the deleted_at filter in owns_medical_document.
create or replace function public.teacher_has_document_share(uid uuid, doc_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1
    from public.medical_document_shares sh
    join public.teachers t on t.id = sh.teacher_id
    join public.medical_documents d on d.id = sh.document_id
    where sh.document_id = doc_id
      and sh.revoked_at is null
      and d.deleted_at is null
      and t.profile_id = uid
  );
$$;

-- True when this customer (uid) has ever booked a session with teacher t_id.
-- Gates who a customer may share PHI with: only a teacher they've booked.
create or replace function public.customer_booked_teacher(uid uuid, t_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1
    from public.bookings b
    join public.sessions s on s.id = b.session_id
    where b.customer_id = uid and s.teacher_id = t_id
  );
$$;

-- ── 4. RLS ───────────────────────────────────────────────────────────────────
alter table public.medical_documents          enable row level security;
alter table public.medical_document_shares    enable row level security;
alter table public.medical_document_access_log enable row level security;

-- documents: the owner has full control over their own rows; the INSERT check
-- also pins the storage_path under their own uid folder so a row can never point
-- at someone else's object. Teachers get read of rows shared with them.
drop policy if exists "medical_documents_owner_select" on public.medical_documents;
create policy "medical_documents_owner_select" on public.medical_documents
  for select using (auth.uid() = customer_id);

drop policy if exists "medical_documents_owner_insert" on public.medical_documents;
create policy "medical_documents_owner_insert" on public.medical_documents
  for insert with check (
    auth.uid() = customer_id
    and storage_path like (auth.uid()::text || '/%')
  );

-- The WITH CHECK pins storage_path under the owner's OWN folder (same guard as
-- the INSERT policy). Without it, an owner could UPDATE storage_path to point at
-- another user's object — which the service-role download route would then sign,
-- defeating revocation and exposing another account's file. customer_id is also
-- pinned to self so a row can't be re-homed to another user.
drop policy if exists "medical_documents_owner_update" on public.medical_documents;
create policy "medical_documents_owner_update" on public.medical_documents
  for update using (auth.uid() = customer_id)
  with check (
    auth.uid() = customer_id
    and storage_path like (auth.uid()::text || '/%')
  );

-- NOTE: intentionally NO client DELETE policy. A direct row delete would CASCADE
-- and wipe that document's medical_document_access_log history, undermining the
-- append-only audit trail. Deletion goes through the service-role DELETE route
-- (app/api/medical-documents/[id]), which soft-deletes the row (deleted_at) AND
-- removes the bytes — so erasure still happens, but the audit log survives. The
-- drop below clears the policy if an earlier revision of this migration created it.
drop policy if exists "medical_documents_owner_delete" on public.medical_documents;

drop policy if exists "medical_documents_teacher_read" on public.medical_documents;
create policy "medical_documents_teacher_read" on public.medical_documents
  for select using (public.teacher_has_document_share(auth.uid(), id));
-- NOTE: deliberately no admin policy → admins cannot read PHI via their own token.

-- shares: owner can list shares of their own docs; teacher can see shares
-- addressed to them. All WRITES go through the validated RPCs below (no client
-- insert/update/delete policy), so a share can only be created/revoked through
-- the ownership + booking checks.
drop policy if exists "medical_document_shares_owner_select" on public.medical_document_shares;
create policy "medical_document_shares_owner_select" on public.medical_document_shares
  for select using (public.owns_medical_document(auth.uid(), document_id));

drop policy if exists "medical_document_shares_teacher_read" on public.medical_document_shares;
create policy "medical_document_shares_teacher_read" on public.medical_document_shares
  for select using (public.owns_teacher(auth.uid(), teacher_id));

-- access log: the document owner can read who accessed their LIVE files. Inserts
-- are service-role only (no insert policy), so the log can't be forged or cleared
-- by a client. NB: owns_medical_document filters deleted_at, so once a document is
-- soft-deleted the owner no longer reads its log via this policy — the rows are
-- retained in-table for service-role/compliance use, not surfaced to the customer
-- (the customer UI likewise only lists history for live documents).
drop policy if exists "medical_document_access_log_owner_read" on public.medical_document_access_log;
create policy "medical_document_access_log_owner_read" on public.medical_document_access_log
  for select using (public.owns_medical_document(auth.uid(), document_id));

-- ── 5. Share / revoke RPCs (validated, SECURITY DEFINER) ──────────────────────
-- Share a document with a teacher the customer has booked. Idempotent: a repeat
-- of an already-active pair is a no-op; re-sharing after a revoke adds a fresh
-- active row (the old revoked row stays as history).
create or replace function public.share_medical_document(
  p_document_id uuid,
  p_teacher_id uuid
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_share_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if not public.owns_medical_document(v_uid, p_document_id) then
    raise exception 'not your document';
  end if;
  if not public.customer_booked_teacher(v_uid, p_teacher_id) then
    raise exception 'you can only share with a teacher you have booked';
  end if;

  insert into public.medical_document_shares (document_id, teacher_id, shared_by)
  values (p_document_id, p_teacher_id, v_uid)
  on conflict (document_id, teacher_id) where revoked_at is null do nothing
  returning id into v_share_id;

  if v_share_id is null then
    select id into v_share_id
      from public.medical_document_shares
     where document_id = p_document_id and teacher_id = p_teacher_id and revoked_at is null;
  end if;
  return v_share_id;
end $$;

-- Revoke a customer's active share with a teacher.
create or replace function public.revoke_medical_document_share(
  p_document_id uuid,
  p_teacher_id uuid
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if not public.owns_medical_document(v_uid, p_document_id) then
    raise exception 'not your document';
  end if;
  update public.medical_document_shares
     set revoked_at = now()
   where document_id = p_document_id and teacher_id = p_teacher_id and revoked_at is null;
end $$;

-- Keep both out of anon's reach; grant to authenticated (they self-gate on
-- auth.uid() ownership). Mirrors the 0018 / 0025 grant hardening.
revoke execute on function public.share_medical_document(uuid, uuid) from public, anon;
revoke execute on function public.revoke_medical_document_share(uuid, uuid) from public, anon;
grant execute on function public.share_medical_document(uuid, uuid) to authenticated;
grant execute on function public.revoke_medical_document_share(uuid, uuid) to authenticated;
