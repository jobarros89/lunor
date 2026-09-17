# Inventário de interface — LUNOR

Base analisada: `2f2a609`. Inventário estrutural; a validação visual ponta a ponta continua sendo uma etapa separada.

## Rotas, layouts e estados

| Arquivo | Tipo | Componentes de interface |
|---|---|---|
| `src/app/(auth)/esqueci-senha/page.tsx` | page | Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Link, MailCheck |
| `src/app/(auth)/layout.tsx` | layout |  |
| `src/app/(auth)/login/page.tsx` | page | BrandLockup, Button, Card, CardContent, CardDescription, CardHeader, GoogleIcon, Input, Label, Link, LoginForm, Suspense |
| `src/app/(auth)/redefinir-senha/page.tsx` | page | Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Estado, Eye, EyeOff, Input, Label, Link, RedefinirSenhaContent, Suspense |
| `src/app/(auth)/signup/page.tsx` | page | SignupForm |
| `src/app/(setup)/comecar/page.tsx` | page | Button, Card, CardContent, CardDescription, CardHeader, CardTitle, ComecarContent, Input, Label, Suspense |
| `src/app/[churchSlug]/admin/page.tsx` | page | Button, CampusesManager, Card, CardContent, CardDescription, CardHeader, CardTitle, ChevronRight, CreateMinistryForm, DailyVerseSettings, DeleteChurchZone, DepartmentsManager, Download, EditChurchName, InviteLink, Link |
| `src/app/[churchSlug]/assinatura/page.tsx` | page | Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, ClaimPaymentButton, HeartHandshake |
| `src/app/[churchSlug]/assistente/page.tsx` | page | AssistantPanel, McpAccessCard |
| `src/app/[churchSlug]/disponibilidade/page.tsx` | page | AvailabilityCalendar, AvailabilityPanel, Link |
| `src/app/[churchSlug]/distribuicao/page.tsx` | page | AlertTriangle, ArrowRight, Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, HeartHandshake, Link, PersonRow, RotateCcw, SummaryCard, Users |
| `src/app/[churchSlug]/equipamentos/[id]/editar/page.tsx` | page | EquipmentForm |
| `src/app/[churchSlug]/equipamentos/[id]/page.tsx` | page | Badge, Button, Card, CardContent, CardHeader, CardTitle, InfoRow, Link, Pencil, Wrench |
| `src/app/[churchSlug]/equipamentos/novo/page.tsx` | page | EquipmentForm |
| `src/app/[churchSlug]/equipamentos/page.tsx` | page | Badge, Button, Card, CardContent, CardHeader, CardTitle, Link, LoadError, Plus |
| `src/app/[churchSlug]/error.tsx` | error | Button, Card, CardContent, RotateCcw |
| `src/app/[churchSlug]/escalas/[id]/editar/page.tsx` | page | EventScheduleForm |
| `src/app/[churchSlug]/escalas/[id]/modo-culto/page.tsx` | page | ArrowLeft, Badge, Card, CardContent, CardHeader, CardTitle, CheckCircle2, Clock3, CultModeTeam, Link, ListMusic, MapPin, ServiceItem, Users |
| `src/app/[churchSlug]/escalas/[id]/page.tsx` | page | ArrowUpRight, AssignmentManager, Badge, CalendarDays, Card, CardContent, CardDescription, CardHeader, CardTitle, Clock3, DeleteFutureEventButton, EventSetlistSummary, Link, LoadError, MapPin, MyAssignmentCard, ServiceOrderCard, Users |
| `src/app/[churchSlug]/escalas/novo/page.tsx` | page | EventForm |
| `src/app/[churchSlug]/escalas/page.tsx` | page | Badge, Button, Card, CardContent, ChevronDown, FutureEventLink, Link, LoadError, Plus, Record |
| `src/app/[churchSlug]/guia/page.tsx` | page | Badge, Card, CardContent, CardHeader, CardTitle, Link |
| `src/app/[churchSlug]/infantil/configuracoes/page.tsx` | page | KidsClassSettingsForm, KidsPrintSettingsForm |
| `src/app/[churchSlug]/infantil/crianca/[childId]/page.tsx` | page | ArrowLeft, Button, ChildEditPanel, ChildGuardianManager, Link |
| `src/app/[churchSlug]/infantil/disponibilidade/page.tsx` | page |  |
| `src/app/[churchSlug]/infantil/escalas/[eventId]/page.tsx` | page | MinistryEventSchedule, WhatsAppPublishControl |
| `src/app/[churchSlug]/infantil/escalas/nova/page.tsx` | page | ArrowLeft, Link, MinistryEventPicker |
| `src/app/[churchSlug]/infantil/escalas/page.tsx` | page | Button, Link, MinistryScheduleList, Plus |
| `src/app/[churchSlug]/infantil/layout.tsx` | layout | KidsSectionNav |
| `src/app/[churchSlug]/infantil/nova/page.tsx` | page | ChildForm |
| `src/app/[churchSlug]/infantil/page.tsx` | page | Baby, Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, ChevronDown, ChevronRight, GuardianAccountLink, GuardianKidsPage, Icon, KidsReceptionBar, Link, Metric, TriangleAlert |
| `src/app/[churchSlug]/infantil/recepcao/[sessionId]/page.tsx` | page | Card, CardContent, KidsDeliveryOverview, ReceptionSearch |
| `src/app/[churchSlug]/infantil/responsaveis/page.tsx` | page | Card, CardContent, CardDescription, CardHeader, CardTitle, GuardianAccountLink, GuardianInvitePanel, Link2, ShieldCheck |
| `src/app/[churchSlug]/infantil/retirada/[token]/page.tsx` | page | Badge, Card, CardContent, QrPickupConfirm, ShieldCheck |
| `src/app/[churchSlug]/infantil/sessao/[eventId]/layout.tsx` | layout |  |
| `src/app/[churchSlug]/infantil/sessao/[eventId]/page.tsx` | page | Card, CardContent, EndSessionButton, KidsDeliveryOverview, ReceptionSearch |
| `src/app/[churchSlug]/layout.tsx` | layout | Avatar, AvatarFallback, AvatarImage, BottomNav, BrandLockup, Button, KidsNoticeBanner, LogOut, SessionKeeper, Sidebar, ThemeToggle |
| `src/app/[churchSlug]/loading.tsx` | loading | Skeleton |
| `src/app/[churchSlug]/louvor/[songId]/editar/page.tsx` | page | ArrowLeft, Button, Card, CardContent, Link, SongForm |
| `src/app/[churchSlug]/louvor/[songId]/page.tsx` | page | ArrowLeft, Badge, Button, Card, CardContent, CardHeader, CardTitle, ChordImporter, ExternalLink, Link, Music, Pencil, SongArchiveButton, SongContentTabs, SongDeleteButton, Video |
| `src/app/[churchSlug]/louvor/disponibilidade/page.tsx` | page |  |
| `src/app/[churchSlug]/louvor/escalas/[eventId]/page.tsx` | page | MinistryEventSchedule, WhatsAppPublishControl |
| `src/app/[churchSlug]/louvor/escalas/nova/page.tsx` | page | ArrowLeft, Link, MinistryEventPicker |
| `src/app/[churchSlug]/louvor/escalas/page.tsx` | page | Button, Link, MinistryScheduleList, Plus |
| `src/app/[churchSlug]/louvor/layout.tsx` | layout | LouvorSectionNav |
| `src/app/[churchSlug]/louvor/page.tsx` | page | Button, CalendarDays, Card, CardContent, CardDescription, CardHeader, CardTitle, Layers3, Link, Music, Plus, SongForm, SongLibrary, TabLink, Video, YouTubeSongImporter |
| `src/app/[churchSlug]/louvor/repertorios/[eventId]/page.tsx` | page | AddToSetlist, ArrowLeft, CalendarDays, Card, CardContent, CardDescription, CardHeader, CardTitle, Clock3, Link, LoadError, SetlistCard |
| `src/app/[churchSlug]/mais/page.tsx` | page | BookOpen, Card, CardContent, CardDescription, CardHeader, CardTitle, ChevronRight, Icon, InviteLink, Link, PushToggle, ShellNavItemId |
| `src/app/[churchSlug]/manutencoes/[id]/page.tsx` | page | Badge, Card, CardContent, CardHeader, CardTitle, Link, TicketUpdate |
| `src/app/[churchSlug]/manutencoes/novo/page.tsx` | page | TicketForm |
| `src/app/[churchSlug]/manutencoes/page.tsx` | page | Badge, Button, Card, CardContent, Link, Plus, TicketCard |
| `src/app/[churchSlug]/page.tsx` | page | ArrowRight, AssistantHomeInput, Badge, CultModeBanner, DeferredDistributionPanel, DeferredOperationalSummary, DistributionOverview, DistributionPanel, DistributionPanelFallback, Link, Megaphone, OnboardingChecklistCard, OperationalSummary, OperationalSummaryFallback, OperationalSummarySection, QuickConfirm, ReturnType, Suspense |
| `src/app/[churchSlug]/perfil/page.tsx` | page | Avatar, AvatarFallback, AvatarImage, Badge, Button, Card, CardContent, ChevronRight, Download, Link, PushToggle |
| `src/app/[churchSlug]/pessoas/[userId]/page.tsx` | page | Avatar, AvatarFallback, AvatarImage, Badge, Card, CardContent, CardHeader, CardTitle, ChurchRoleToggle, MinistryManager, SkillManager, UnavailabilityManager |
| `src/app/[churchSlug]/pessoas/page.tsx` | page | Avatar, AvatarFallback, AvatarImage, Badge, Card, CardContent, Link, LoadError |
| `src/app/[churchSlug]/versiculo-do-dia/page.tsx` | page | BookOpen, Card, CardContent, ShareDailyVerse |
| `src/app/error.tsx` | error | Button, Card, CardContent, RotateCcw |
| `src/app/familia/acesso/page.tsx` | page | BrandLockup, Card, CardContent, CardDescription, CardHeader, CardTitle, Link |
| `src/app/global-error.tsx` | global-error |  |
| `src/app/layout.tsx` | layout | SwRegister, ThemeProvider, Toaster |
| `src/app/not-found.tsx` | not-found | Button, Card, CardContent, Link |
| `src/app/onboarding/page.tsx` | page | BrandLockup, OnboardingWizard |
| `src/app/page.tsx` | page | Image, Link, PublicEntry |
| `src/app/painel/error.tsx` | error | Button, Card, CardContent, RotateCcw |
| `src/app/painel/layout.tsx` | layout | Link, SessionKeeper, ShieldCheck, ThemeToggle |
| `src/app/painel/loading.tsx` | loading | Skeleton |
| `src/app/painel/page.tsx` | page | BillingPanel, Card, CardContent, CardHeader, CardTitle, Link, NovaIgreja |
| `src/app/privacidade/page.tsx` | page | Doc, Link, Nota, UL |
| `src/app/q/[token]/page.tsx` | page | BrandLockup, Card, CardContent |
| `src/app/termos/page.tsx` | page | Doc, Link, Nota, UL |

## Handlers preservados

- `src/app/[churchSlug]/escalas/[id]/calendario/route.ts`
- `src/app/[churchSlug]/exportar/igreja/route.ts`
- `src/app/[churchSlug]/exportar/pessoal/route.ts`
- `src/app/api/ai/assistant/route.ts`
- `src/app/api/ai/attention/route.ts`
- `src/app/api/ai/status/route.ts`
- `src/app/api/cron/route.ts`
- `src/app/api/cron/verse/route.ts`
- `src/app/api/health/route.ts`
- `src/app/api/integrations/youtube/callback/route.ts`
- `src/app/api/integrations/youtube/connect/route.ts`
- `src/app/api/mcp/route.ts`
- `src/app/api/whatsapp/evolution/webhook/route.ts`
- `src/app/api/whatsapp/send/route.ts`
- `src/app/api/whatsapp/webhook/route.ts`
- `src/app/auth/callback/route.ts`
- `src/app/auth/logout/route.ts`
- `src/app/auth/recovery/route.ts`
- `src/app/convite/[code]/route.ts`
- `src/app/familia/[token]/route.ts`

## Componentes

| Arquivo | Responsabilidade / exportação |
|---|---|
| `src/components/admin/campuses-manager.tsx` | CampusesManager |
| `src/components/admin/create-ministry-form.tsx` | CreateMinistryForm |
| `src/components/admin/daily-verse-settings.tsx` | DailyVerseSettings |
| `src/components/admin/delete-church.tsx` | DeleteChurchZone |
| `src/components/admin/departments-manager.tsx` | DepartmentsManager |
| `src/components/admin/edit-church-name.tsx` | EditChurchName |
| `src/components/ai/assistant-launcher.tsx` | AssistantLauncher |
| `src/components/ai/assistant-panel.tsx` | AssistantPanel |
| `src/components/ai/copilot-priorities.tsx` | CopilotPriorities |
| `src/components/ai/human-review.tsx` | HumanReview |
| `src/components/ai/mcp-access-card.tsx` | McpAccessCard |
| `src/components/ai/recurring-event-proposal-card.tsx` | RecurringEventProposalCard |
| `src/components/bible/share-daily-verse.tsx` | ShareDailyVerse |
| `src/components/billing/claim-payment-button.tsx` | ClaimPaymentButton |
| `src/components/brand-lockup.tsx` | BrandLockup |
| `src/components/disponibilidade/availability-calendar.tsx` | AvailabilityCalendar |
| `src/components/equipamentos/equipment-form.tsx` | Field, EquipmentForm |
| `src/components/escalas/assignment-manager.tsx` | AssignmentManager |
| `src/components/escalas/availability-panel.tsx` | RequestResponseCard, TeamStatusGroup, TeamAvailabilityCard, AvailabilityPanel |
| `src/components/escalas/cult-mode-team.tsx` | CultModeTeam |
| `src/components/escalas/evaluation-panel.tsx` | EvaluationPanel |
| `src/components/escalas/event-delete-control.tsx` | ConfirmDeleteDialog, FutureEventLink, DeleteFutureEventButton |
| `src/components/escalas/event-form.tsx` | EventForm |
| `src/components/escalas/event-schedule-form.tsx` | EventScheduleForm |
| `src/components/escalas/leader-schedule-metrics.tsx` | LeaderScheduleMetrics, MetricCard, EventList, PeopleList |
| `src/components/escalas/ministry-event-picker.tsx` | MinistryEventPicker |
| `src/components/escalas/ministry-event-schedule.tsx` | MinistryEventSchedule, SmallMetric |
| `src/components/escalas/ministry-schedule-list.tsx` | MinistryScheduleList |
| `src/components/escalas/ministry-service-window-card.tsx` | MinistryServiceWindowCard |
| `src/components/escalas/my-assignment-card.tsx` | MyAssignmentCard |
| `src/components/escalas/quick-confirm.tsx` | QuickConfirm |
| `src/components/escalas/service-order-card.tsx` | ItemForm, ServiceOrderCard |
| `src/components/escalas/whatsapp-publish-button.tsx` | WhatsAppPublishButton |
| `src/components/escalas/whatsapp-publish-control.tsx` | WhatsAppPublishControl |
| `src/components/home/assistant-attention-center.tsx` | AssistantAttentionCenter |
| `src/components/home/assistant-home-input.tsx` | AssistantHomeInput |
| `src/components/home/cult-mode-banner.tsx` | CultModeBanner |
| `src/components/home/distribution-panel.tsx` | DistributionPanel, Stat |
| `src/components/home/onboarding-checklist.tsx` | OnboardingChecklistCard |
| `src/components/home/operational-summary.tsx` | OperationalSummarySection, Metric |
| `src/components/infantil/child-edit-panel.tsx` | ChildEditPanel |
| `src/components/infantil/child-form.tsx` | ChildForm |
| `src/components/infantil/child-guardian-manager.tsx` | ChildGuardianManager |
| `src/components/infantil/end-session-button.tsx` | EndSessionButton |
| `src/components/infantil/family-invite-qr.tsx` | FamilyInviteQr |
| `src/components/infantil/guardian-account-link.tsx` | GuardianAccountLink |
| `src/components/infantil/guardian-inline-invite.tsx` | GuardianInlineInvite |
| `src/components/infantil/guardian-invite-panel.tsx` | GuardianInvitePanel |
| `src/components/infantil/guardian-kids-dashboard.tsx` | GuardianKidsDashboard |
| `src/components/infantil/guardian-kids-page.tsx` | GuardianKidsPage |
| `src/components/infantil/kids-class-settings-form.tsx` | KidsClassSettingsForm |
| `src/components/infantil/kids-delivery-overview.tsx` | KidsDeliveryOverview |
| `src/components/infantil/kids-delivery-status.tsx` | KidsDeliveryStatusView |
| `src/components/infantil/kids-notice-banner.tsx` | KidsNoticeBanner |
| `src/components/infantil/kids-print-settings-form.tsx` | KidsPrintSettingsForm |
| `src/components/infantil/kids-reception-bar.tsx` | KidsReceptionBar |
| `src/components/infantil/kids-section-nav.tsx` | KidsSectionNav |
| `src/components/infantil/pickup-qr.tsx` | PickupQr |
| `src/components/infantil/print-label-button.tsx` | PrintLabelButton |
| `src/components/infantil/qr-pickup-confirm.tsx` | QrPickupConfirm |
| `src/components/infantil/reception-search.tsx` | ReceptionSearch |
| `src/components/infantil/seed-classes-button.tsx` | SeedClassesButton |
| `src/components/infantil/session-child.tsx` | SessionChildRow |
| `src/components/invite-link.tsx` | InviteLink |
| `src/components/louvor/add-to-setlist.tsx` | AddToSetlist |
| `src/components/louvor/chord-importer.tsx` | ChordImporter, Meta, Preview |
| `src/components/louvor/event-setlist-summary.tsx` | EventSetlistSummary |
| `src/components/louvor/louvor-section-nav.tsx` | LouvorSectionNav |
| `src/components/louvor/setlist-card.tsx` | SetlistCard |
| `src/components/louvor/song-archive-button.tsx` | SongArchiveButton |
| `src/components/louvor/song-content-tabs.tsx` | SongContentTabs |
| `src/components/louvor/song-delete-button.tsx` | SongDeleteButton |
| `src/components/louvor/song-form.tsx` | SongForm |
| `src/components/louvor/song-library.tsx` | SongLibrary |
| `src/components/louvor/time-signature-picker.tsx` | TimeSignaturePicker |
| `src/components/louvor/youtube-song-importer.tsx` | YouTubeSongImporter |
| `src/components/manutencoes/ticket-form.tsx` | TicketForm |
| `src/components/manutencoes/ticket-update.tsx` | TicketUpdate |
| `src/components/onboarding/wizard.tsx` | Chip, Progress, OnboardingWizard, OwnerWizard, MemberWizard |
| `src/components/painel/billing-panel.tsx` | BillingPanel |
| `src/components/painel/nova-igreja.tsx` | NovaIgreja |
| `src/components/pessoas/church-role-toggle.tsx` | ChurchRoleToggle |
| `src/components/pessoas/ministry-manager.tsx` | MinistryManager |
| `src/components/pessoas/skill-manager.tsx` | SkillManager |
| `src/components/pessoas/unavailability-manager.tsx` | UnavailabilityManager |
| `src/components/push/push-toggle.tsx` | PushToggle |
| `src/components/shell/bottom-nav.tsx` | BottomNav |
| `src/components/shell/load-error.tsx` | LoadError |
| `src/components/shell/sector-switcher.tsx` | SectorSwitcher |
| `src/components/shell/session-keeper.tsx` | SessionKeeper |
| `src/components/shell/sidebar.tsx` | Sidebar |
| `src/components/shell/theme-toggle.tsx` | ThemeToggle |
| `src/components/signup-form.tsx` | SignupForm |
| `src/components/sw-register.tsx` | SwRegister |
| `src/components/theme-provider.tsx` | ThemeProvider |
| `src/components/ui/avatar.tsx` | Avatar, AvatarImage, AvatarFallback, AvatarBadge, AvatarGroup, AvatarGroupCount |
| `src/components/ui/badge.tsx` | Badge |
| `src/components/ui/button.tsx` | Button |
| `src/components/ui/card.tsx` | Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent, CardFooter |
| `src/components/ui/dropdown-menu.tsx` | DropdownMenu, DropdownMenuPortal, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuItem, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuCheckboxItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuShortcut |
| `src/components/ui/empty-state.tsx` | EmptyState |
| `src/components/ui/field.tsx` | Field |
| `src/components/ui/input.tsx` | Input |
| `src/components/ui/label.tsx` | Label |
| `src/components/ui/section-nav.tsx` | SectionNav |
| `src/components/ui/separator.tsx` | Separator |
| `src/components/ui/sheet.tsx` | Sheet, SheetTrigger, SheetClose, SheetPortal, SheetOverlay, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription |
| `src/components/ui/skeleton.tsx` | Skeleton |
| `src/components/ui/sonner.tsx` |  |
