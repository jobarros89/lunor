-- Migration histórica aplicada em produção e ausente no repositório.
-- Mantida com o mesmo timestamp para que o histórico remoto/local permaneça reproduzível.

drop function if exists public.create_guardian_invite(uuid);
