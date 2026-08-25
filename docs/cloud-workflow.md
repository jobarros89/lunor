# Fluxo cloud-first do LUNOR

Este projeto não depende do Mac do desenvolvedor para compilar, testar ou hospedar a aplicação.

## Ambientes

| Ambiente | Execução | Banco |
| --- | --- | --- |
| Pull request | GitHub Actions | Supabase efêmero no runner |
| Desenvolvimento compartilhado | Cloudflare Workers (a configurar) | Supabase DEV hospedado |
| Produção | Será criado quando houver usuários reais | Supabase PROD separado |

O comando `npx supabase start` existe apenas no CI. Ele sobe containers temporários no runner Linux do GitHub, aplica todas as migrations e executa os testes de RLS. O ambiente é descartado ao final e nunca acessa o Supabase DEV hospedado.

## Fluxo de mudança

1. Criar uma branch a partir de `main`.
2. Implementar a mudança no Codex Cloud.
3. Abrir um pull request.
4. Aguardar typecheck, migrations e testes.
5. Fazer squash merge somente com o CI verde.
6. O deploy do ambiente compartilhado será automatizado em uma etapa separada.

## Regras

- Não executar Docker ou Supabase local no Mac.
- Não aplicar migrations manualmente pelo Dashboard.
- Não commitar `.env`, tokens, senhas, chaves privadas ou `service_role`.
- Toda mudança de banco deve existir em `supabase/migrations/`.
- Testes de RLS usam exclusivamente o Supabase efêmero do GitHub Actions.
- O frontend usa apenas a URL e a chave pública do Supabase DEV.
- Segredos de servidor ficam no provedor de deploy, nunca em variáveis `NEXT_PUBLIC_`.
- Produção terá projeto Supabase e credenciais próprios.

## Responsabilidades

- GitHub: fonte oficial, branches, pull requests e CI.
- GitHub Actions: instalação, typecheck, banco efêmero e testes.
- Supabase hospedado: Auth, Postgres, Storage e RLS do ambiente DEV.
- Cloudflare Workers: frontend Next.js/OpenNext, cron e segredos de runtime.
- Mac: somente navegador e recuperação emergencial.
