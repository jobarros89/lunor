# Integração da Bíblia Livre (BLT) — Versículo do Dia

## ✅ O que foi implementado

### 1. **Suporte à Bíblia Livre como tradução padrão**
- Arquivo: `src/lib/bible/fetch-verse-free.ts`
- Busca diretamente do repositório público: `thiagobodruk/biblia`
- **Licença:** CC0 (domínio público)
- **Vantagem:** Zero risco de licença; permissivo para SaaS pago
- **Fallback:** 8s de timeout, então falha graciosamente

### 2. **Integração no cliente principal**
- Arquivo: `src/lib/bible/fetch-verse.ts` 
- Se `version === 'blt'`, usa `fetchVerseTextFromFree()`
- Outras versões (nvi, acf, ra): via ABíbliaDigital (se configurado)
- Padrão: BLT

### 3. **UI de Settings**
- Componente: `src/components/admin/daily-verse-settings.tsx`
- Action: `src/lib/actions/daily-verse-settings.ts`
- Opções:
  - ☑ Ativar/desativar versículo do dia
  - Escolher tradução (BLT, NVI, ACF, RA)
  - Escolher tema ou rotação automática
- Salva em `churches.settings.notifications`:
  ```json
  {
    "daily_verse_enabled": true,
    "daily_verse_version": "blt",
    "daily_verse_theme": "auto" | "gratidao" | "fe" | "amor" | "esperanca" | "sabedoria" | "paz"
  }
  ```

### 4. **Rota de cron já existe**
- Arquivo: `src/app/api/cron/verse/route.ts`
- Dispara via `wrangler.jsonc` → `0 12 * * *` (12:00 UTC, todo dia)
- RPC Supabase: `versiculo_alvos` + `versiculo_registrar`
- Segurança: `CRON_SECRET` (igual a `/api/cron`)

### 5. **Tabela + RPCs no banco**
- Migração: `supabase/migrations/20260905041924_daily_verse.sql`
- Tabela: `daily_verse_sends` (auditoria)
- RPCs: `versiculo_alvos`, `versiculo_registrar` (SECURITY DEFINER)

### 6. **Testes**
- `tests/lib/select-verse.test.ts` — seleção determinística de versículos
- `tests/lib/select-theme.test.ts` — seleção de tema por IA + fallback

---

## 📋 O que falta antes de produção

### 1. **Definir a tradução padrão**
Se vocês têm licença corporativa de NVI/ACF/RA, considere usar como padrão.
Caso contrário, BLT é a escolha correcta (CC0, sem complicações).

### 2. **Configurar env vars (opcional)**
Se quiser suportar outras versões via ABíbliaDigital:
```bash
BIBLE_API_BASE_URL=https://www.abibliadigital.com.br/api
BIBLE_API_TOKEN=<seu-token-gratuito>
```

### 3. **Adicionar o componente ao admin**
Arquivo: `src/app/[churchSlug]/admin/page.tsx`
Adicionar junto com os outros formulários:
```tsx
import { DailyVerseSettings } from "@/components/admin/daily-verse-settings";

// Dentro do componente AdminPage, adicionar:
<DailyVerseSettings 
  churchId={cid} 
  currentConfig={church?.settings?.notifications}
/>
```

### 4. **Rodar a migração**
```bash
supabase migration up
```

### 5. **Testar o fluxo**
1. Ir a `/admin` de uma igreja
2. Ativar "Versículo do dia"
3. Escolher tradução + tema
4. Salvar
5. Esperar até 12h UTC (ou testar endpoint manualmente)

---

## 🔐 Segurança de licença

**Bíblia Livre (BLT)**
- Licença: CC0 (domínio público)
- Atribuição: opcional (é boa prática, mas não obrigatório)
- Comercial: permitido
- **Decisão:** Use sem medo

**Outras (NVI, ACF, RA)**
- Licença: protegida
- Comercial: depende do acordo com a sociedade bíblica
- **Estratégia LUNOR:** cada igreja configura a sua tradução
  - Sua própria licença corporativa? Mude o padrão
  - Tem dúvida? Use BLT

---

## 🎯 Próximos passos (prioridade)

1. **Merge dos PRs** (#160, #161, #162, #152, #153, #156, #158, #167)
2. **Decidir tradução padrão** (recomendação: BLT, zero complicações)
3. **Integrar componente no admin** (1-2h)
4. **Testar end-to-end** (envio de versículo)
5. **Documentar para igrejas** (no app, o que é o versículo do dia)

---

## 📚 Referências

- **Bíblia Livre:** https://github.com/blivre/BibliaLivre
- **Dados (thiagobodruk):** https://github.com/thiagobodruk/biblia
- **ABíbliaDigital:** https://www.abibliadigital.com.br/
