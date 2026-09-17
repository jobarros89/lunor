# Modernização da experiência LUNOR

Base: `main` em `2f2a609688ffcb908180b895464219c983e55f07` (17/09/2026).

## Análise antes da implementação

Inventário: 654 arquivos versionados; páginas e layouts de autenticação, onboarding, igreja, Louvor, Kids, disponibilidade, escalas, pessoas, patrimônio/manutenção, assinatura, assistente, plataforma e documentos públicos. A árvore de rotas inclui também os handlers de API, convites, exportação e autenticação, fora do escopo de alteração.

Stack: Next App Router, React, TypeScript, Tailwind 4, Base UI/shadcn, Lucide; PWA e shell Capacitor. Os componentes de dados chamam server actions e recebem os mesmos contratos em todas as mudanças desta revisão.

O design existente usa Geist e Cormorant, fundo claro quente e tema escuro, wordmark LUNOR e prismas próprios. Há tokens semânticos, mas muitos controles repetem cores literais. O token accent mistura destaque de marca e hover; navegação lateral e inferior usam destaques diferentes. Títulos, alturas dos campos, raios e estados de foco variam entre módulos. O acervo tem busca sem rótulo explícito, metadados pouco diferenciados e estado vazio sem orientação. A agenda comprime conteúdo e resposta em três colunas no celular. Há animações de deslocamento sem alternativa explícita para movimento reduzido.

Referência visual inspecionada: https://spell.sh/docs/components. Princípios aplicados: hierarquia clara, superfícies neutras, bordas discretas, navegação ativa legível e feedback contido. Identidade, ilustrações, telas e código do Spell UI não são copiados.

## Plano de implementação

1. Separar tokens de marca dos estados neutros; unificar campos, cartões, foco e movimento.
2. Harmonizar sidebar, navegação inferior e navegação dos módulos; manter os destinos e critérios de visibilidade existentes.
3. Aplicar tipografia e espaçamento consistentes às telas; melhorar leitura da home, listas e formulários em larguras pequenas.
4. Melhorar busca e estados vazios do acervo, seleção do calendário e visibilidade de contexto/ações.
5. Revisar erros, carregamento, diálogos e temas claro/escuro.
6. Executar lint, TypeScript, testes locais e build. Documentar separadamente qualquer validação que dependa de Supabase efêmero, login ou dispositivo nativo.

## Limites

Não modificar banco, migrations, RLS, critérios de permissão, autenticação, contratos de API, rotas ou decisões do assistente. A implementação é isolada para revisão; sem merge ou publicação em produção.

## Validação

- `npm run lint`: passou, sem erros ou warnings de ESLint.
- `npx tsc --noEmit`: passou.
- `npm test -- tests/lib tests/ui`: 45 arquivos e 279 testes passaram.
- `npm run build`: passou (Next 16.3.3, compilação, TypeScript e geração das páginas estáticas).
- Os três testes de interação validam busca/estado vazio/limpar, navegação com endereço preservado e rascunho de disponibilidade até confirmação explícita.
- `git diff --check`: passou. Nenhuma mudança em `src/lib`, `supabase`, API, callbacks de auth ou projetos nativos.
- RLS/integracão com banco não executados: exigem Supabase efêmero. Os testes executados não chamam o banco real.
- Responsividade visual da versão alterada **pendente**: a prévia local não ficou acessível no navegador remoto. Inspeção estática e testes DOM não substituem screenshots nem validação em aparelho. A PR deve permanecer rascunho até essa etapa.
- A consulta ao guia interno de diagnóstico do navegador foi rejeitada pela revisão automática, por classificar a leitura como possível acesso a conteúdo privado. Nenhum contorno foi utilizado.

## Ajuste necessário para o build

O build da própria base falhava porque `initOpenNextCloudflareForDev()` era chamado em produção e tentava autenticar uma sessão remota do Cloudflare. A chamada agora ocorre apenas em `NODE_ENV=development`. Não foram alterados os bindings, credenciais, Worker ou comportamento da IA em produção. `jsdom` foi adicionado somente como dependência de desenvolvimento para os testes DOM.

## Revisão visual antes de aprovar

Verificar em 320, 375, 390, 768 e 1440 pixels, claro e escuro:

1. Login, cadastro e onboarding: leitura, teclado e mensagens de erro.
2. Home: agenda, títulos longos, menu de resposta e áreas seguras.
3. Louvor: navegação por nível, busca, estados vazios, música, arranjo e repertório.
4. Kids: navegação com rolagem, operação, formulários, responsáveis e painéis.
5. Disponibilidade: campus, mês, seleção, rascunho e confirmação; liderança e voluntário.
6. Escalas, equipe, patrimônio e administração: formulários, listas extensas e ações.
7. Assistente: sugestões, mensagens, revisão humana, painel e teclado.
8. Foco por teclado, movimento reduzido, modal acima do menu inferior e ausência de overflow.

A inspeção de produção antes da mudança não valida a versão modificada. Este trabalho moderniza os padrões compartilhados e fluxos descritos; não representa uma auditoria visual concluída de todas as telas.
