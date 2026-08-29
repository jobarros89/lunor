-- LUNOR Kids V1: remove o caminho legado de deduplicacao que ainda executava
-- UPDATE com os privilegios do chamador. O hardening mantem apenas o trigger
-- protegido por SECURITY DEFINER definido em 20260829190000_kids_v1_hardening.sql.

-- O trigger antigo foi criado em 20260828211500_kids_active_call_dedupe.sql.
-- Depois que UPDATE direto em child_pages foi revogado, ele passou a bloquear
-- INSERTs validos antes que o trigger protegido pudesse assumir o fluxo.
drop trigger if exists dedupe_active_child_call on public.child_pages;
drop function if exists public.dedupe_active_child_call();

-- Recria explicitamente o unico caminho de dedupe para deixar o estado final
-- deterministico, mesmo em ambientes que tenham aplicado todas as migrations.
drop trigger if exists trg_child_pages_dedupe_active on public.child_pages;
create trigger trg_child_pages_dedupe_active
before insert on public.child_pages
for each row
execute function public.dedupe_active_child_call_before_insert();
