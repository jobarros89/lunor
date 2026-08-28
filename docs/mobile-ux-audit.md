# LUNOR Mobile — auditoria UX inicial

Status: em andamento
Branch: `mobile/capacitor`

## O que já está bem encaminhado

- Login usa layout dedicado escuro e largura limitada para mobile.
- Inputs e botão principal têm 48px de altura, adequados para toque.
- `viewportFit: cover` já está habilitado no root layout.
- Bottom navigation já respeita `safe-area-inset-bottom`.
- Bottom navigation é específica para mobile (`md:hidden`) e possui estado ativo e badges.
- PWA/Apple Web App metadata já existe.
- Tema pós-login permanece claro por padrão, com suporte a tema do sistema.

## Ajustes prioritários antes do primeiro teste real

### P0 — validar no APK

- Persistência de sessão após fechar e reabrir o app.
- Fluxo login → igreja/home sem abrir navegador externo.
- Recuperação e redefinição de senha dentro do shell.
- Comportamento do botão Voltar no Android.
- Teclado em login, signup, criação de escala e formulários longos.
- Safe areas no topo e rodapé em iPhones com notch/Dynamic Island.
- Links externos (YouTube/Spotify) abrirem no aplicativo/navegador adequado.

### P1 — sensação de aplicativo

- Definir status bar nativa coerente com login dark e app light/dark.
- Splash LUNOR simples, preto, sem estética mística.
- Aplicar o ícone preto LUNOR aprovado a Android, iOS, PWA e Apple Touch Icon.
- Evitar hover como único feedback; garantir feedback de toque/pressed state.
- Avaliar transições/loading entre telas para evitar sensação de website.

### P1 — navegação

A navegação inferior atual pode chegar a 6 entradas dependendo dos módulos/perfil. Em telas estreitas isso pode ficar visualmente apertado, mesmo com ícones sem label visível.

Revisar em aparelho real:
- Início
- ministério ativo
- Kids (quando independente)
- Escalas
- Equipe (líder)
- Perfil

Objetivo: manter no máximo 4–5 destinos principais no dock e mover destinos secundários para Perfil/Mais, se necessário.

## Hipótese para Home mobile

Não mudar a regra de negócio da Home web neste momento. Primeiro validar o app empacotado. Depois avaliar uma composição mobile mais direta:

1. próxima escala/serviço;
2. repertório relacionado;
3. confirmações/pendências;
4. equipe/avisos relevantes.

Isso pode ser feito progressivamente sem reconstruir o produto nativamente.

## Critério da primeira versão instalável

A primeira versão é considerada apta para teste quando:

- APK abre o LUNOR em tela cheia;
- login funciona;
- sessão permanece ativa;
- navegação principal funciona sem sair do shell;
- botão Voltar não quebra o fluxo;
- teclado não bloqueia ações essenciais;
- ícone e splash oficiais estão aplicados;
- nenhuma tela principal apresenta overflow horizontal.
