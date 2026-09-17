# Inventário de interface — LUNOR

Base auditada antes das alterações: `2f2a609688ffcb908180b895464219c983e55f07`. Inventário estrutural atualizado em 17/09/2026 para refletir os componentes da PR. Rotas e handlers não foram criados ou removidos. A cobertura abaixo descreve código; não significa validação visual ponta a ponta.

Totais: 56 páginas, 20 handlers, 13 layouts/estados e 127 arquivos de componentes.

## Rotas e telas

| Rota | Arquivo | Componentes usados na apresentação |
|---|---|---|
| `/esqueci-senha` | `src/app/(auth)/esqueci-senha/page.tsx` | Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Link, MailCheck |
| `/login` | `src/app/(auth)/login/page.tsx` | Alert, BrandLockup, Button, Card, CardContent, CardDescription, CardHeader, FormSkeleton, GoogleIcon, Input, Label, Link, LoginForm, PasswordInput, Suspense |
| `/redefinir-senha` | `src/app/(auth)/redefinir-senha/page.tsx` | Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Eye, EyeOff, FormSkeleton, Input, Label, Link, RedefinirSenhaContent, Suspense |
| `/signup` | `src/app/(auth)/signup/page.tsx` | SignupForm |
| `/comecar` | `src/app/(setup)/comecar/page.tsx` | Button, Card, CardContent, CardDescription, CardHeader, CardTitle, ComecarContent, FormSkeleton, Input, Label, Suspense |
| `/[churchSlug]/admin` | `src/app/[churchSlug]/admin/page.tsx` | Button, CampusesManager, Card, CardContent, CardDescription, CardHeader, CardTitle, ChevronRight, CreateMinistryForm, DailyVerseSettings, DeleteChurchZone, DepartmentsManager, Download, EditChurchName, InviteLink, Link, PageHeader |
| `/[churchSlug]/assinatura` | `src/app/[churchSlug]/assinatura/page.tsx` | Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, ClaimPaymentButton, HeartHandshake, PageHeader |
| `/[churchSlug]/assistente` | `src/app/[churchSlug]/assistente/page.tsx` | AssistantPanel, McpAccessCard, PageHeader |
| `/[churchSlug]/disponibilidade` | `src/app/[churchSlug]/disponibilidade/page.tsx` | AvailabilityCalendar, AvailabilityPanel, Link, PageHeader, SectionNav |
| `/[churchSlug]/distribuicao` | `src/app/[churchSlug]/distribuicao/page.tsx` | AlertTriangle, ArrowRight, Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, HeartHandshake, Link, PageHeader, PersonRow, RotateCcw, SummaryCard, Users |
| `/[churchSlug]/equipamentos/[id]/editar` | `src/app/[churchSlug]/equipamentos/[id]/editar/page.tsx` | EquipmentForm, PageHeader |
| `/[churchSlug]/equipamentos/[id]` | `src/app/[churchSlug]/equipamentos/[id]/page.tsx` | Badge, Button, Card, CardContent, CardHeader, CardTitle, InfoRow, Link, Pencil, Wrench |
| `/[churchSlug]/equipamentos/novo` | `src/app/[churchSlug]/equipamentos/novo/page.tsx` | EquipmentForm, PageHeader |
| `/[churchSlug]/equipamentos` | `src/app/[churchSlug]/equipamentos/page.tsx` | Button, Card, CardContent, CardHeader, CardTitle, EmptyState, EquipmentDirectory, Link, LoadError, PageHeader, Plus |
| `/[churchSlug]/escalas/[id]/editar` | `src/app/[churchSlug]/escalas/[id]/editar/page.tsx` | EventScheduleForm, PageHeader |
| `/[churchSlug]/escalas/[id]/modo-culto` | `src/app/[churchSlug]/escalas/[id]/modo-culto/page.tsx` | ArrowLeft, Badge, Card, CardContent, CardHeader, CardTitle, CheckCircle2, Clock3, CultModeTeam, Link, ListMusic, MapPin, Users |
| `/[churchSlug]/escalas/[id]` | `src/app/[churchSlug]/escalas/[id]/page.tsx` | ArrowUpRight, AssignmentManager, Badge, CalendarDays, Card, CardContent, CardDescription, CardHeader, CardTitle, Clock3, DeleteFutureEventButton, EventSetlistSummary, Link, LoadError, MapPin, MyAssignmentCard, ServiceOrderCard, Users |
| `/[churchSlug]/escalas/novo` | `src/app/[churchSlug]/escalas/novo/page.tsx` | EventForm, PageHeader |
| `/[churchSlug]/escalas` | `src/app/[churchSlug]/escalas/page.tsx` | Badge, Button, Card, CardContent, ChevronDown, FutureEventLink, Link, LoadError, PageHeader, Plus, SectionNav |
| `/[churchSlug]/guia` | `src/app/[churchSlug]/guia/page.tsx` | Badge, Card, CardContent, CardHeader, CardTitle, Link, PageHeader |
| `/[churchSlug]/infantil/configuracoes` | `src/app/[churchSlug]/infantil/configuracoes/page.tsx` | KidsClassSettingsForm, KidsPrintSettingsForm, PageHeader |
| `/[churchSlug]/infantil/crianca/[childId]` | `src/app/[churchSlug]/infantil/crianca/[childId]/page.tsx` | ArrowLeft, Button, ChildEditPanel, ChildGuardianManager, Link, PageHeader |
| `/[churchSlug]/infantil/disponibilidade` | `src/app/[churchSlug]/infantil/disponibilidade/page.tsx` | — |
| `/[churchSlug]/infantil/escalas/[eventId]` | `src/app/[churchSlug]/infantil/escalas/[eventId]/page.tsx` | MinistryEventSchedule, WhatsAppPublishControl |
| `/[churchSlug]/infantil/escalas/nova` | `src/app/[churchSlug]/infantil/escalas/nova/page.tsx` | ArrowLeft, Link, MinistryEventPicker, PageHeader |
| `/[churchSlug]/infantil/escalas` | `src/app/[churchSlug]/infantil/escalas/page.tsx` | Button, Link, MinistryScheduleList, PageHeader, Plus |
| `/[churchSlug]/infantil/nova` | `src/app/[churchSlug]/infantil/nova/page.tsx` | ChildForm, PageHeader |
| `/[churchSlug]/infantil` | `src/app/[churchSlug]/infantil/page.tsx` | Baby, Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, ChevronDown, ChevronRight, GuardianAccountLink, GuardianKidsPage, Icon, KidsReceptionBar, Link, Metric, PageHeader, TriangleAlert |
| `/[churchSlug]/infantil/recepcao/[sessionId]` | `src/app/[churchSlug]/infantil/recepcao/[sessionId]/page.tsx` | Card, CardContent, KidsDeliveryOverview, PageHeader, ReceptionSearch |
| `/[churchSlug]/infantil/responsaveis` | `src/app/[churchSlug]/infantil/responsaveis/page.tsx` | Card, CardContent, CardDescription, CardHeader, CardTitle, GuardianAccountLink, GuardianInvitePanel, Link2, PageHeader, ShieldCheck |
| `/[churchSlug]/infantil/retirada/[token]` | `src/app/[churchSlug]/infantil/retirada/[token]/page.tsx` | Badge, Card, CardContent, PageHeader, QrPickupConfirm, ShieldCheck |
| `/[churchSlug]/infantil/sessao/[eventId]` | `src/app/[churchSlug]/infantil/sessao/[eventId]/page.tsx` | Card, CardContent, EndSessionButton, KidsDeliveryOverview, PageHeader, ReceptionSearch |
| `/[churchSlug]/louvor/[songId]/editar` | `src/app/[churchSlug]/louvor/[songId]/editar/page.tsx` | ArrowLeft, Button, Card, CardContent, Link, PageHeader, SongForm |
| `/[churchSlug]/louvor/[songId]` | `src/app/[churchSlug]/louvor/[songId]/page.tsx` | ArrowLeft, Badge, Button, Card, CardContent, CardHeader, CardTitle, ChordImporter, ExternalLink, Link, Music, PageHeader, Pencil, SongArchiveButton, SongContentTabs, SongDeleteButton, Video |
| `/[churchSlug]/louvor/disponibilidade` | `src/app/[churchSlug]/louvor/disponibilidade/page.tsx` | — |
| `/[churchSlug]/louvor/escalas/[eventId]` | `src/app/[churchSlug]/louvor/escalas/[eventId]/page.tsx` | MinistryEventSchedule, WhatsAppPublishControl |
| `/[churchSlug]/louvor/escalas/nova` | `src/app/[churchSlug]/louvor/escalas/nova/page.tsx` | ArrowLeft, Link, MinistryEventPicker, PageHeader |
| `/[churchSlug]/louvor/escalas` | `src/app/[churchSlug]/louvor/escalas/page.tsx` | Button, Link, MinistryScheduleList, PageHeader, Plus |
| `/[churchSlug]/louvor` | `src/app/[churchSlug]/louvor/page.tsx` | Button, CalendarDays, Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState, Layers3, Link, Music, PageHeader, Plus, SongForm, SongLibrary, TabLink, Video, YouTubeSongImporter |
| `/[churchSlug]/louvor/repertorios/[eventId]` | `src/app/[churchSlug]/louvor/repertorios/[eventId]/page.tsx` | AddToSetlist, ArrowLeft, CalendarDays, Card, CardContent, CardDescription, CardHeader, CardTitle, Clock3, Link, LoadError, PageHeader, SetlistCard |
| `/[churchSlug]/mais` | `src/app/[churchSlug]/mais/page.tsx` | BookOpen, Card, CardContent, CardDescription, CardHeader, CardTitle, ChevronRight, Icon, InviteLink, Link, PageHeader, PushToggle |
| `/[churchSlug]/manutencoes/[id]` | `src/app/[churchSlug]/manutencoes/[id]/page.tsx` | Badge, Card, CardContent, CardHeader, CardTitle, Link, TicketUpdate |
| `/[churchSlug]/manutencoes/novo` | `src/app/[churchSlug]/manutencoes/novo/page.tsx` | PageHeader, TicketForm |
| `/[churchSlug]/manutencoes` | `src/app/[churchSlug]/manutencoes/page.tsx` | Badge, Button, Card, CardContent, Link, PageHeader, Plus, TicketCard |
| `/[churchSlug]` | `src/app/[churchSlug]/page.tsx` | ArrowRight, AssistantHomeInput, Badge, CultModeBanner, DeferredDistributionPanel, DeferredOperationalSummary, DistributionPanel, DistributionPanelFallback, EmptyState, Link, Megaphone, NextServiceCard, OnboardingChecklistCard, OperationalSummaryFallback, OperationalSummarySection, QuickConfirm, SectionHeader, Suspense |
| `/[churchSlug]/perfil` | `src/app/[churchSlug]/perfil/page.tsx` | Avatar, AvatarFallback, AvatarImage, Badge, Button, Card, CardContent, ChevronRight, Download, Link, PushToggle |
| `/[churchSlug]/pessoas/[userId]` | `src/app/[churchSlug]/pessoas/[userId]/page.tsx` | Avatar, AvatarFallback, AvatarImage, Badge, Card, CardContent, CardHeader, CardTitle, ChurchRoleToggle, MinistryManager, SkillManager, UnavailabilityManager |
| `/[churchSlug]/pessoas` | `src/app/[churchSlug]/pessoas/page.tsx` | LoadError, PageHeader, TeamDirectory |
| `/[churchSlug]/versiculo-do-dia` | `src/app/[churchSlug]/versiculo-do-dia/page.tsx` | BookOpen, Card, CardContent, ShareDailyVerse |
| `/familia/acesso` | `src/app/familia/acesso/page.tsx` | BrandLockup, Card, CardContent, CardDescription, CardHeader, CardTitle, Link |
| `/onboarding` | `src/app/onboarding/page.tsx` | BrandLockup, OnboardingWizard |
| `/` | `src/app/page.tsx` | Image, Link, PublicEntry |
| `/painel` | `src/app/painel/page.tsx` | BillingPanel, Card, CardContent, CardHeader, CardTitle, Link, NovaIgreja |
| `/privacidade` | `src/app/privacidade/page.tsx` | Doc, H, Link, Nota, P, UL |
| `/q/[token]` | `src/app/q/[token]/page.tsx` | BrandLockup, Card, CardContent |
| `/termos` | `src/app/termos/page.tsx` | Doc, H, Link, Nota, P, UL |

## Layouts e estados compartilhados

| Arquivo | Componentes usados na apresentação |
|---|---|
| `src/app/(auth)/layout.tsx` | — |
| `src/app/[churchSlug]/error.tsx` | ErrorState |
| `src/app/[churchSlug]/infantil/layout.tsx` | KidsSectionNav |
| `src/app/[churchSlug]/infantil/sessao/[eventId]/layout.tsx` | — |
| `src/app/[churchSlug]/layout.tsx` | Avatar, AvatarFallback, AvatarImage, BottomNav, BrandLockup, Button, KidsNoticeBanner, LogOut, OfflineNotice, SessionKeeper, Sidebar, ThemeToggle |
| `src/app/[churchSlug]/loading.tsx` | Skeleton |
| `src/app/[churchSlug]/louvor/layout.tsx` | LouvorSectionNav |
| `src/app/error.tsx` | ErrorState |
| `src/app/layout.tsx` | SwRegister, ThemeProvider, Toaster |
| `src/app/not-found.tsx` | Button, Card, CardContent, Link |
| `src/app/painel/error.tsx` | ErrorState |
| `src/app/painel/layout.tsx` | Link, SessionKeeper, ShieldCheck, ThemeToggle |
| `src/app/painel/loading.tsx` | Skeleton |

## Handlers e integrações (preservados)

| Rota | Arquivo |
|---|---|
| `/[churchSlug]/escalas/[id]/calendario` | `src/app/[churchSlug]/escalas/[id]/calendario/route.ts` |
| `/[churchSlug]/exportar/igreja` | `src/app/[churchSlug]/exportar/igreja/route.ts` |
| `/[churchSlug]/exportar/pessoal` | `src/app/[churchSlug]/exportar/pessoal/route.ts` |
| `/api/ai/assistant` | `src/app/api/ai/assistant/route.ts` |
| `/api/ai/attention` | `src/app/api/ai/attention/route.ts` |
| `/api/ai/status` | `src/app/api/ai/status/route.ts` |
| `/api/cron` | `src/app/api/cron/route.ts` |
| `/api/cron/verse` | `src/app/api/cron/verse/route.ts` |
| `/api/health` | `src/app/api/health/route.ts` |
| `/api/integrations/youtube/callback` | `src/app/api/integrations/youtube/callback/route.ts` |
| `/api/integrations/youtube/connect` | `src/app/api/integrations/youtube/connect/route.ts` |
| `/api/mcp` | `src/app/api/mcp/route.ts` |
| `/api/whatsapp/evolution/webhook` | `src/app/api/whatsapp/evolution/webhook/route.ts` |
| `/api/whatsapp/send` | `src/app/api/whatsapp/send/route.ts` |
| `/api/whatsapp/webhook` | `src/app/api/whatsapp/webhook/route.ts` |
| `/auth/callback` | `src/app/auth/callback/route.ts` |
| `/auth/logout` | `src/app/auth/logout/route.ts` |
| `/auth/recovery` | `src/app/auth/recovery/route.ts` |
| `/convite/[code]` | `src/app/convite/[code]/route.ts` |
| `/familia/[token]` | `src/app/familia/[token]/route.ts` |

## Componentes

| Arquivo | Exportações |
|---|---|
| `src/components/admin/campuses-manager.tsx` | CampusesManager |
| `src/components/admin/create-ministry-form.tsx` | CreateMinistryForm |
| `src/components/admin/daily-verse-settings.tsx` | DailyVerseConfig, DailyVerseSettings |
| `src/components/admin/delete-church.tsx` | DeleteChurchZone |
| `src/components/admin/departments-manager.tsx` | DepartmentsManager |
| `src/components/admin/edit-church-name.tsx` | EditChurchName |
| `src/components/ai/assistant-launcher.tsx` | AssistantLauncher |
| `src/components/ai/assistant-panel.tsx` | AssistantPanel |
| `src/components/ai/copilot-priorities.tsx` | CopilotPriorities |
| `src/components/ai/human-review.tsx` | HumanReview |
| `src/components/ai/mcp-access-card.tsx` | McpAccessListItem, McpAccessCard |
| `src/components/ai/recurring-event-proposal-card.tsx` | RecurringEventProposal, RecurringEventProposalCard |
| `src/components/bible/share-daily-verse.tsx` | ShareDailyVerse |
| `src/components/billing/claim-payment-button.tsx` | ClaimPaymentButton |
| `src/components/brand-lockup.tsx` | BrandLockup |
| `src/components/disponibilidade/availability-calendar.tsx` | CalendarAvailabilityEntry, AvailabilityCampus, AvailabilityCalendar |
| `src/components/equipamentos/equipment-directory.tsx` | EquipmentListItem, EquipmentDirectory |
| `src/components/equipamentos/equipment-form.tsx` | EquipmentFormValues, EquipmentForm |
| `src/components/escalas/assignment-manager.tsx` | AssignmentRow, AssignmentManager |
| `src/components/escalas/availability-panel.tsx` | AvailabilityEvent, AvailabilityRequestView, AvailabilityPanel |
| `src/components/escalas/cult-mode-team.tsx` | CultModeAssignment, CultModeTeam |
| `src/components/escalas/evaluation-panel.tsx` | EvaluationValues, EvaluationPanel |
| `src/components/escalas/event-delete-control.tsx` | FutureEventLink, DeleteFutureEventButton |
| `src/components/escalas/event-form.tsx` | EventForm |
| `src/components/escalas/event-schedule-form.tsx` | EventScheduleForm |
| `src/components/escalas/leader-schedule-metrics.tsx` | LeaderScheduleEvent, LeaderSchedulePerson, LeaderScheduleMetrics |
| `src/components/escalas/ministry-event-picker.tsx` | MinistryEventPickerRow, MinistryEventPicker |
| `src/components/escalas/ministry-event-schedule.tsx` | MinistryEventSchedule |
| `src/components/escalas/ministry-schedule-list.tsx` | MinistryScheduleList |
| `src/components/escalas/ministry-service-window-card.tsx` | MinistryServiceWindowCard |
| `src/components/escalas/my-assignment-card.tsx` | MyAssignmentCard |
| `src/components/escalas/quick-confirm.tsx` | QuickConfirm |
| `src/components/escalas/service-order-card.tsx` | ServiceItem, ServiceOrderCard |
| `src/components/escalas/whatsapp-publish-button.tsx` | WhatsAppPublishButton |
| `src/components/escalas/whatsapp-publish-control.tsx` | WhatsAppPublishControl |
| `src/components/home/assistant-attention-center.tsx` | AssistantAttentionCenter |
| `src/components/home/assistant-home-input.tsx` | AssistantHomeInput |
| `src/components/home/cult-mode-banner.tsx` | CultModeBanner |
| `src/components/home/distribution-panel.tsx` | DistributionPanel |
| `src/components/home/next-service-card.tsx` | NextServiceCard |
| `src/components/home/onboarding-checklist.tsx` | OnboardingChecklistCard |
| `src/components/home/operational-summary.tsx` | OperationalSummarySection |
| `src/components/infantil/child-edit-panel.tsx` | EditableKidsChild, ChildEditPanel |
| `src/components/infantil/child-form.tsx` | ChildForm |
| `src/components/infantil/child-guardian-manager.tsx` | ChildGuardianManager |
| `src/components/infantil/end-session-button.tsx` | EndSessionButton |
| `src/components/infantil/family-invite-qr.tsx` | FamilyInviteQr |
| `src/components/infantil/guardian-account-link.tsx` | GuardianAccountLink |
| `src/components/infantil/guardian-inline-invite.tsx` | GuardianInlineInvite |
| `src/components/infantil/guardian-invite-panel.tsx` | GuardianInvitePanel |
| `src/components/infantil/guardian-kids-dashboard.tsx` | GuardianKidsDashboard |
| `src/components/infantil/guardian-kids-page.tsx` | GuardianKidsPage |
| `src/components/infantil/kids-class-settings-form.tsx` | KidsClassSettingsRow, KidsClassSettingsForm |
| `src/components/infantil/kids-delivery-overview.tsx` | KidsDeliveryItem, KidsDeliveryOverview |
| `src/components/infantil/kids-delivery-status.tsx` | KidsDeliveryStatus, KidsDeliveryStatusView |
| `src/components/infantil/kids-notice-banner.tsx` | KidsPersonalNotice, KidsNoticeBanner |
| `src/components/infantil/kids-print-settings-form.tsx` | KidsPrintSettingsForm |
| `src/components/infantil/kids-reception-bar.tsx` | KidsReceptionBar |
| `src/components/infantil/kids-section-nav.tsx` | KidsSectionNav |
| `src/components/infantil/pickup-qr.tsx` | PickupQr |
| `src/components/infantil/print-label-button.tsx` | PrintLabelButton |
| `src/components/infantil/qr-pickup-confirm.tsx` | PickupGuardian, QrPickupConfirm |
| `src/components/infantil/reception-search.tsx` | ReceptionSearch |
| `src/components/infantil/seed-classes-button.tsx` | SeedClassesButton |
| `src/components/infantil/session-child.tsx` | Guardian, KidsClassOption, SessionChild, SessionChildRow |
| `src/components/invite-link.tsx` | InviteLink |
| `src/components/louvor/add-to-setlist.tsx` | AddToSetlist |
| `src/components/louvor/chord-importer.tsx` | ChordImporter |
| `src/components/louvor/event-setlist-summary.tsx` | EventSetlistSummaryItem, EventSetlistSummary |
| `src/components/louvor/louvor-section-nav.tsx` | LouvorSectionNav |
| `src/components/louvor/setlist-card.tsx` | SetlistCard |
| `src/components/louvor/song-archive-button.tsx` | SongArchiveButton |
| `src/components/louvor/song-content-tabs.tsx` | RehearsalMaterial, ArrangementVersionOption, SongContentTabs |
| `src/components/louvor/song-delete-button.tsx` | SongDeleteButton |
| `src/components/louvor/song-form.tsx` | SongForm |
| `src/components/louvor/song-library.tsx` | SongLibrary |
| `src/components/louvor/time-signature-picker.tsx` | TimeSignaturePicker |
| `src/components/louvor/youtube-song-importer.tsx` | YouTubeSongImporter |
| `src/components/manutencoes/ticket-form.tsx` | TicketForm |
| `src/components/manutencoes/ticket-update.tsx` | TicketUpdate |
| `src/components/onboarding/wizard.tsx` | OnboardingWizard |
| `src/components/painel/billing-panel.tsx` | BillingChurch, BillingPanel |
| `src/components/painel/nova-igreja.tsx` | NovaIgreja |
| `src/components/pessoas/church-role-toggle.tsx` | ChurchRoleToggle |
| `src/components/pessoas/ministry-manager.tsx` | MinistryManager |
| `src/components/pessoas/skill-manager.tsx` | SkillManager |
| `src/components/pessoas/team-directory.tsx` | DirectoryMember, TeamDirectory |
| `src/components/pessoas/unavailability-manager.tsx` | UnavailabilityManager, CalendarOff |
| `src/components/push/push-toggle.tsx` | PushToggle |
| `src/components/shell/bottom-nav.tsx` | BottomNav |
| `src/components/shell/error-state.tsx` | ErrorState |
| `src/components/shell/load-error.tsx` | LoadError |
| `src/components/shell/offline-notice.tsx` | OfflineNotice |
| `src/components/shell/sector-switcher.tsx` | SectorSwitcher |
| `src/components/shell/session-keeper.tsx` | SessionKeeper |
| `src/components/shell/sidebar-state.ts` | SIDEBAR_STORAGE_KEY, SIDEBAR_ATTRIBUTE |
| `src/components/shell/sidebar.tsx` | Sidebar |
| `src/components/shell/theme-toggle.tsx` | ThemeToggle |
| `src/components/signup-form.tsx` | SignupForm |
| `src/components/sw-register.tsx` | SwRegister |
| `src/components/theme-provider.tsx` | ThemeProvider, useTheme |
| `src/components/ui/alert.tsx` | Alert |
| `src/components/ui/avatar.tsx` | Avatar, AvatarImage, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarBadge |
| `src/components/ui/badge.tsx` | Badge, badgeVariants |
| `src/components/ui/button.tsx` | Button, buttonVariants |
| `src/components/ui/card.tsx` | Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent |
| `src/components/ui/checkbox.tsx` | Checkbox |
| `src/components/ui/dialog.tsx` | Dialog, DialogTrigger, DialogClose, DialogContent, DialogTitle, DialogDescription |
| `src/components/ui/dropdown-menu.tsx` | DropdownMenu, DropdownMenuPortal, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent |
| `src/components/ui/empty-state.tsx` | EmptyState |
| `src/components/ui/field.tsx` | Field |
| `src/components/ui/filter-bar.tsx` | FilterBar |
| `src/components/ui/form-section.tsx` | FormSection |
| `src/components/ui/form-skeleton.tsx` | FormSkeleton |
| `src/components/ui/input.tsx` | Input |
| `src/components/ui/label.tsx` | Label |
| `src/components/ui/page-header.tsx` | PageHeader, SectionHeader |
| `src/components/ui/password-input.tsx` | PasswordInput |
| `src/components/ui/search-input.tsx` | SearchInput |
| `src/components/ui/section-nav.tsx` | SectionNavItem, SectionNav |
| `src/components/ui/select.tsx` | Select |
| `src/components/ui/separator.tsx` | Separator |
| `src/components/ui/sheet.tsx` | Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription |
| `src/components/ui/skeleton.tsx` | Skeleton |
| `src/components/ui/sonner.tsx` | Toaster |
| `src/components/ui/tabs.tsx` | Tabs, TabsList, TabsTrigger, TabsContent |
| `src/components/ui/textarea.tsx` | Textarea |

## Outros arquivos de apresentação

- `src/app/global-error.tsx`
- `src/app/globals.css`
- `src/app/manifest.ts`

## Telas alteradas diretamente nesta PR (47)

Além das telas abaixo, os componentes compartilhados afetam suas demais instâncias listadas no inventário.

| Rota | Arquivo |
|---|---|
| `/esqueci-senha` | `src/app/(auth)/esqueci-senha/page.tsx` |
| `/login` | `src/app/(auth)/login/page.tsx` |
| `/redefinir-senha` | `src/app/(auth)/redefinir-senha/page.tsx` |
| `/comecar` | `src/app/(setup)/comecar/page.tsx` |
| `/[churchSlug]/admin` | `src/app/[churchSlug]/admin/page.tsx` |
| `/[churchSlug]/assinatura` | `src/app/[churchSlug]/assinatura/page.tsx` |
| `/[churchSlug]/assistente` | `src/app/[churchSlug]/assistente/page.tsx` |
| `/[churchSlug]/disponibilidade` | `src/app/[churchSlug]/disponibilidade/page.tsx` |
| `/[churchSlug]/distribuicao` | `src/app/[churchSlug]/distribuicao/page.tsx` |
| `/[churchSlug]/equipamentos/[id]/editar` | `src/app/[churchSlug]/equipamentos/[id]/editar/page.tsx` |
| `/[churchSlug]/equipamentos/[id]` | `src/app/[churchSlug]/equipamentos/[id]/page.tsx` |
| `/[churchSlug]/equipamentos/novo` | `src/app/[churchSlug]/equipamentos/novo/page.tsx` |
| `/[churchSlug]/equipamentos` | `src/app/[churchSlug]/equipamentos/page.tsx` |
| `/[churchSlug]/escalas/[id]/editar` | `src/app/[churchSlug]/escalas/[id]/editar/page.tsx` |
| `/[churchSlug]/escalas/[id]/modo-culto` | `src/app/[churchSlug]/escalas/[id]/modo-culto/page.tsx` |
| `/[churchSlug]/escalas/[id]` | `src/app/[churchSlug]/escalas/[id]/page.tsx` |
| `/[churchSlug]/escalas/novo` | `src/app/[churchSlug]/escalas/novo/page.tsx` |
| `/[churchSlug]/escalas` | `src/app/[churchSlug]/escalas/page.tsx` |
| `/[churchSlug]/guia` | `src/app/[churchSlug]/guia/page.tsx` |
| `/[churchSlug]/infantil/configuracoes` | `src/app/[churchSlug]/infantil/configuracoes/page.tsx` |
| `/[churchSlug]/infantil/crianca/[childId]` | `src/app/[churchSlug]/infantil/crianca/[childId]/page.tsx` |
| `/[churchSlug]/infantil/escalas/nova` | `src/app/[churchSlug]/infantil/escalas/nova/page.tsx` |
| `/[churchSlug]/infantil/escalas` | `src/app/[churchSlug]/infantil/escalas/page.tsx` |
| `/[churchSlug]/infantil/nova` | `src/app/[churchSlug]/infantil/nova/page.tsx` |
| `/[churchSlug]/infantil` | `src/app/[churchSlug]/infantil/page.tsx` |
| `/[churchSlug]/infantil/recepcao/[sessionId]` | `src/app/[churchSlug]/infantil/recepcao/[sessionId]/page.tsx` |
| `/[churchSlug]/infantil/responsaveis` | `src/app/[churchSlug]/infantil/responsaveis/page.tsx` |
| `/[churchSlug]/infantil/retirada/[token]` | `src/app/[churchSlug]/infantil/retirada/[token]/page.tsx` |
| `/[churchSlug]/infantil/sessao/[eventId]` | `src/app/[churchSlug]/infantil/sessao/[eventId]/page.tsx` |
| `/[churchSlug]/louvor/[songId]/editar` | `src/app/[churchSlug]/louvor/[songId]/editar/page.tsx` |
| `/[churchSlug]/louvor/[songId]` | `src/app/[churchSlug]/louvor/[songId]/page.tsx` |
| `/[churchSlug]/louvor/escalas/nova` | `src/app/[churchSlug]/louvor/escalas/nova/page.tsx` |
| `/[churchSlug]/louvor/escalas` | `src/app/[churchSlug]/louvor/escalas/page.tsx` |
| `/[churchSlug]/louvor` | `src/app/[churchSlug]/louvor/page.tsx` |
| `/[churchSlug]/louvor/repertorios/[eventId]` | `src/app/[churchSlug]/louvor/repertorios/[eventId]/page.tsx` |
| `/[churchSlug]/mais` | `src/app/[churchSlug]/mais/page.tsx` |
| `/[churchSlug]/manutencoes/[id]` | `src/app/[churchSlug]/manutencoes/[id]/page.tsx` |
| `/[churchSlug]/manutencoes/novo` | `src/app/[churchSlug]/manutencoes/novo/page.tsx` |
| `/[churchSlug]/manutencoes` | `src/app/[churchSlug]/manutencoes/page.tsx` |
| `/[churchSlug]` | `src/app/[churchSlug]/page.tsx` |
| `/[churchSlug]/perfil` | `src/app/[churchSlug]/perfil/page.tsx` |
| `/[churchSlug]/pessoas/[userId]` | `src/app/[churchSlug]/pessoas/[userId]/page.tsx` |
| `/[churchSlug]/pessoas` | `src/app/[churchSlug]/pessoas/page.tsx` |
| `/[churchSlug]/versiculo-do-dia` | `src/app/[churchSlug]/versiculo-do-dia/page.tsx` |
| `/familia/acesso` | `src/app/familia/acesso/page.tsx` |
| `/painel` | `src/app/painel/page.tsx` |
| `/q/[token]` | `src/app/q/[token]/page.tsx` |
