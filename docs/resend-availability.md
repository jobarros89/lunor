# E-mail de disponibilidade

Solicitações de disponibilidade continuam usando Web Push e passam a enviar também e-mail transacional pelo Resend.

## Produção

- Secret server-only: `RESEND_API_KEY`.
- Remetente: `LUNOR <notificacoes@send.lunorservice.com>`.
- Domínio de envio: `send.lunorservice.com`.
- A falha do provedor de e-mail não impede a criação da solicitação.
- Cada envio usa idempotência por solicitação e usuário para reduzir duplicidade.
- O endereço do voluntário é lido no servidor pelo Supabase Auth usando o cliente administrativo; nenhuma credencial privilegiada é enviada ao navegador.
- O link do e-mail é resolvido pelo ministério: Louvor abre Louvor > Disponibilidade e Kids abre Infantil > Disponibilidade.
