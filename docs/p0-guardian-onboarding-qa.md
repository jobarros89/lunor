# P0 — Homologação do onboarding de responsável Kids

## Critérios obrigatórios

1. **Convite novo / conta nova**
   - gerar convite informando responsável + e-mail;
   - primeiro acesso ao link mostra nome, e-mail e igreja sem refresh;
   - criar conta abre nome/e-mail pré-preenchidos;
   - após autenticação/confirmar e-mail, o responsável entra direto no Kids;
   - não passa por onboarding genérico de igreja.

2. **Convite novo / conta existente**
   - abrir link mostra identidade do convite;
   - entrar com o mesmo e-mail conclui o vínculo;
   - refresh do link após vínculo é idempotente para a mesma conta.

3. **E-mail incorreto**
   - conta com e-mail diferente não pode resgatar o convite;
   - mensagem deve explicar que é necessário usar o e-mail convidado;
   - convite permanece disponível para a conta correta.

4. **Convite expirado ou legado**
   - não permite criar/vincular conta;
   - orienta gerar um novo convite.

5. **Convite usado por outra conta**
   - não troca `guardians.user_id`;
   - mostra erro específico de vínculo/convite utilizado.

6. **Token inválido**
   - limpa contexto familiar antigo do navegador;
   - não reaproveita convite anterior em cookie;
   - não mostra dados de outro responsável.

7. **Privacidade**
   - prévia pública exibe somente nome do responsável, e-mail destinado e igreja;
   - nunca retorna criança, telefone, dados médicos ou ids internos.

## Regressão dos outros convites

- convite/código de igreja continua usando `lunor_invite` e `join_church`;
- intenção de criar/entrar/convite continua preservada em `lunor_signup_intent`;
- fluxo familiar tem precedência e nunca cai no onboarding genérico enquanto houver convite familiar pendente.
