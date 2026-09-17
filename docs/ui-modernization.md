# Modernização da experiência LUNOR

Base: `main` em `2f2a609688ffcb908180b895464219c983e55f07` (17/09/2026). Branch: `ui/spell-experience-modernization`. PR: [#220](https://github.com/jobarros89/lunor/pull/220).

## Auditoria antes da implementação

O inventário inicial cobriu os 654 arquivos versionados, incluindo a árvore de rotas, componentes, dados, testes, PWA e projetos nativos. O [inventário atualizado](./ui-inventory.md) mapeia as 56 páginas, 20 handlers, 13 layouts/estados e os 127 arquivos de componentes existentes após a implementação.

Stack: Next App Router, React, TypeScript, Tailwind 4, Base UI/shadcn, Lucide; PWA e shell Capacitor. Identidade: Geist e Cormorant, fundo claro quente, tema escuro, wordmark e prismas próprios. Mantida a assinatura **Lunor – Presença · preparo · propósito**.

### Evidências e inconsistências

| Área | Achado | Decisão |
|---|---|---|
| Tokens e controles | Cores literais, raios e alturas repetidos; `accent` confundia destaque de marca e hover | Separar marca, superfícies e interação; consolidar os controles |
| Home | Na produção, destaque inicial amplo e painéis de liderança/assistente antecediam a agenda pessoal | Próximo culto compacto e agenda antes dos painéis de gestão |
| Navegação | Sidebar sem agrupamentos; voluntário dependia de caminhos pouco visíveis para os módulos; dois níveis semelhantes no Louvor | Agrupos por finalidade, atalhos dos módulos habilitados e diferenciação de navegação local |
| Listas | Equipe e equipamentos sem busca local; títulos truncados e metadados disputando espaço | Busca, filtros, contagem, quebra de texto e metadados empilhados |
| Louvor | Busca sem rótulo explícito; abas locais sem padrão completo de teclado; vazios pouco orientativos | SearchInput, Tabs Base UI e EmptyState com próximo passo |
| Disponibilidade | Mês percorrido apenas por setas; rascunho e envio precisavam de maior distinção | Seletor de mês, seleção anunciada, feedback e confirmação explícita preservada |
| Formulários | Campos longos sem grupos, helper/error desacoplados do input, estilos locais duplicados | Field acessível, FormSection, Select/Textarea/Checkbox compartilhados |
| Diálogos | Confirmação artesanal sem contenção robusta de foco; sobreposição com navegação inferior | Base UI para foco/retorno/Escape; camadas e painel mobile revisados |
| Estados | Suspense de autenticação vazio; erros genéricos; ausência de aviso de conexão | Skeleton de formulário, Alert/ErrorState e aviso offline informativo |
| Mobile | Respostas comprimidas em colunas, campos pequenos, drawers estreitos | Empilhamento, controles de toque, campos de 16px e largura integral nos sheets |

A inspeção visual de produção incluiu Home, acervo de Louvor e operação Kids; a navegação de disponibilidade também foi inspecionada. Essas observações são **anteriores** à alteração. O restante da auditoria foi estrutural, no código. Screenshots operacionais com dados pessoais não foram anexados ao repositório.

Referência inspecionada: [Spell UI — componentes](https://spell.sh/docs/components). Aplicados princípios de hierarquia, superfícies neutras, bordas discretas, navegação ativa legível e feedback contido. Nenhuma identidade, tela, ilustração ou implementação proprietária foi copiada.

## Plano definido antes de alterar código

1. Separar tokens de marca dos estados neutros; unificar campos, cartões, foco e movimento.
2. Harmonizar sidebar, navegação inferior e navegação de módulos, preservando os critérios existentes de acesso.
3. Priorizar a operação pessoal na Home e a leitura em telas pequenas.
4. Consolidar cabeçalhos, busca, filtros, formulários e feedback para reutilização entre módulos.
5. Revisar carregamento, vazio, erro, conexão, diálogos e temas.
6. Executar lint, TypeScript, testes e build; fazer segunda revisão e registrar verificações dependentes de navegador, Supabase efêmero e dispositivo nativo.

## Design system implementado

| Fundação | Padrão |
|---|---|
| Marca clara/escura | `#6752d9` / `#a99afa`, com foreground, soft e strong próprios |
| Superfícies | background, card, popover, muted e sidebar semânticos; accent neutro |
| Tipografia | Geist mantida para produto; Cormorant editorial preservada; título de página fluido de 24–32px |
| Espaçamento | Escala Tailwind existente; grupos de formulário de 16px e seções de 24px; containers com largura limitada |
| Raios | Token raiz de 14px; controles arredondados discretos e cartões consistentes |
| Sombras | `--shadow-surface` leve; sem novos efeitos gráficos pesados |
| Responsividade | Breakpoints existentes de 640/768/1024px; shell mobile abaixo de 768px |
| Interações | Focus visível, disabled, aria-invalid, hover discreto, transições curtas e movimento reduzido |

Novos ou consolidados: Button, Input, Select, Textarea, Checkbox, Badge, Avatar, Card, Tabs, Dialog, Sheet, DropdownMenu, Sonner, Alert, EmptyState, Skeleton, FormSkeleton, Field, FormSection, PageHeader, SectionHeader, SectionNav, FilterBar, SearchInput e PasswordInput. Não foram criadas dependências ou abstrações sem consumidor para Radio, Switch, Tooltip ou Table: a árvore atual não utiliza esses padrões como componentes próprios. Seletores nativos e listas semânticas foram mantidos onde atendem melhor aos fluxos existentes.

## Mudanças de experiência

- **Navegação:** grupos “Seu dia”, “Ministérios” e “Organização”; no mobile, atalhos de Louvor/Kids conforme os flags existentes, Escalas e Mais. Responsáveis continuam com a navegação dedicada. Perfil continua acessível por Mais. Links, rotas e regras de visibilidade da camada de dados preservados.
- **Home:** próximo culto compacto, agenda pessoal imediatamente abaixo e painéis de liderança/assistente depois. Mesmas consultas, prioridades calculadas e ações de confirmação.
- **Cabeçalhos:** PageHeader adotado em 30 páginas, com ações que quebram em nova linha no mobile; títulos e descrições consistentes.
- **Equipe e equipamentos:** busca local sem distinção de acentos, contagem, limpeza de filtros e metadados empilhados. Equipamentos também filtram por situação. Só são enviados aos componentes cliente os campos já exibidos; valor financeiro continua condicionado a `tenant.isManager` no servidor.
- **Louvor:** dois níveis de navegação diferenciados, busca rotulada, reset, estados vazios orientativos, abas de letra/cifra/materiais com teclado e títulos extensos sem truncamento nas listas de repertórios/arranjos.
- **Disponibilidade e escalas:** mês/ano selecionável, rascunho preservado ao trocar mês, feedback inline e confirmação mantida. Diálogo de exclusão com foco inicial no cancelamento, retorno de foco e ação destrutiva apenas após confirmação.
- **Kids:** busca de recepção compartilhada, campos de cadastro agrupados, consentimentos intactos, componentes de operação e responsáveis usando os mesmos controles e padrões de leitura.
- **Formulários:** equipamentos agrupados em identificação, propriedade/operação, compra/vida útil e documentação. Login prioriza e-mail/senha e mantém Google; mostrar senha não submete. Onboarding tem etapas nomeadas, foco no título ao avançar e mensagens inline.
- **Estados:** carregamento acessível nos formulários suspensos; erro compartilhado com tentar novamente; aviso offline sem cache, fila ou promessa de salvamento.

## Mobile e desktop

Implementados no código: listas empilhadas, ações quebráveis, áreas de toque de 44px nos controles compartilhados, inputs de 16px no mobile, safe areas, menu inferior com até cinco destinos, dialogs inferiores e sheets em largura integral. No desktop: sidebar agrupada e recolhível, cabeçalhos com ações contextuais, metadados em colunas e diálogos centralizados.

**Essas adaptações ainda não foram validadas visualmente na branch.** Não houve emulação de múltiplas larguras ou teste em aparelho disponível nesta sessão.

## Acessibilidade e performance

Associação de label/helper/erro, aria-current, aria-pressed, aria-busy, estados anunciados, semântica de listas/fieldset, link para pular conteúdo, navegação por teclado nas abas e gerenciamento de foco no diálogo. Movimento reduzido respeitado; contraste revisto nos tokens, sem declaração de certificação WCAG.

Nenhuma nova dependência de produção. Tabs e Dialog usam Base UI já instalada; buscas são locais aos dados carregados; nenhuma nova consulta de rede. Home continua server-rendered. `jsdom` é apenas dependência de desenvolvimento. Não foi medido Lighthouse, Core Web Vitals ou tamanho comparativo de bundle.

## Limites e conferência de escopo

Nenhuma alteração em `src/lib`, handlers de API, callbacks de autenticação, `supabase`, migrations, RLS ou projetos Android/iOS. Uma comparação estrutural das chamadas de server actions e das cadeias de consultas nos 101 arquivos alterados que as contêm não encontrou alterações nos argumentos ou consultas. Isso complementa a revisão, sem substituir testes de integração.

Mudanças funcionais restritas à apresentação: busca/filtro local, navegação de mês, ordem das seções, foco e hierarquia de login. APIs, consentimentos, payloads, cálculos e critérios de autorização permanecem iguais.

### Ajuste necessário para o build

Na base, `initOpenNextCloudflareForDev()` era executado no build e tentava autenticar um proxy remoto. Agora é chamado apenas em `NODE_ENV=development`. Bindings, credenciais, Worker e IA de produção não foram alterados. A configuração do Vitest inclui também `.test.tsx` para executar a nova cobertura de interface.

## Validações executadas

| Verificação | Resultado |
|---|---|
| `npm run lint` | Passou, sem erros ou warnings de ESLint |
| `npx tsc --noEmit` | Passou |
| `npm test -- tests/lib tests/ui` | 46 arquivos, 294 testes passaram |
| `npm run build` | Passou: compilação, TypeScript e geração de páginas estáticas |
| `git diff --check` | Passou |
| RLS/Supabase efêmero | Não executado; exige ambiente descartável de banco |
| Responsividade visual e fluxos autenticados da branch | Pendentes de prévia acessível |

Os 18 testes DOM verificam navegação por perfil, ausência de links administrativos indevidos, sidebar, conexão, label/helper/erro, busca/limpeza/foco, filtros, payload de login, senha visível, onboarding de proprietário/membro, rascunho e envio de disponibilidade, confirmação/cancelamento/Escape/retorno de foco, abas da música e consentimentos/payload do Kids. Os demais 276 testes existentes são de lógica. Ações e serviços são simulados nos testes DOM; não são testes reais de autenticação, banco, impressão ou entrega de criança.

A segunda revisão corrigiu conflito grid/flex em cinco CardHeaders, camadas de sheet/toast, largura mobile, sobreposição na busca de recepção, ativação de abas, foco dos dialogs, quebras de título, estilos redundantes e formatação dos arquivos alterados.

## Pendência para revisão visual final

O guia de diagnóstico do navegador foi consultado após autorização do usuário. A prévia local não pôde ser aberta: a URL de arquivo foi negada pela política do navegador e o servidor HTTP isolado retornou `ERR_BLOCKED_BY_CLIENT`. Não foram usados mecanismos alternativos de automação para contornar o bloqueio. O CI atual da PR não fornece uma prévia da aplicação.

A PR permanece em rascunho até testar uma URL acessível desta branch. Verificar 320, 375, 390, 768 e 1440px, claro/escuro:

1. Login, cadastro e onboarding: teclado, foco, retorno, erros e métodos de acesso.
2. Home: próximo culto, agenda, títulos longos e confirmação.
3. Louvor: níveis de navegação, acervo, música, arranjo e repertório.
4. Kids: operação, recepção, cadastro, responsáveis, retirada e configurações, em ambiente de teste.
5. Disponibilidade: voluntário/liderança, campus, mês, seleção, rascunho e envio.
6. Escalas, equipe, equipamentos, manutenção, administração e perfil: listas extensas, formulários e permissões existentes.
7. Assistente: sugestões, conversa, revisão humana e teclado.
8. Contraste, movimento reduzido, zoom, overflow, safe areas, foco contido e leitura no aparelho.

Screenshots de antes/depois com dados fictícios deverão ser acrescentados após essa verificação. Não tratar screenshots da produção anterior, inspeção estática ou testes DOM como evidência visual da versão modernizada.
