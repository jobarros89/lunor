# P0 onboarding — causas encontradas

- `/familia/acesso` era genérica e não resolvia a identidade do convite.
- `guardian_invites` não armazenava e-mail de destino; por isso o cadastro não podia ser pré-preenchido com segurança.
- o signup familiar dependia do cookie, mas não validava a identidade do convite antes de criar a conta.
- falhas no resgate eram reduzidas a uma única mensagem genérica.
- token inválido não limpava explicitamente um contexto familiar antigo do navegador.
- resgatar novamente um convite já concluído pela mesma conta não era idempotente.

A correção P0 passa a vincular o convite a e-mail, resolver prévia no servidor, validar o e-mail antes do signup, tornar o resgate idempotente para a mesma conta e separar estados inválido/expirado/usado/e-mail divergente/vínculo existente.
