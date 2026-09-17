import { Skeleton } from "@/components/ui/skeleton";

export function FormSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="space-y-5 rounded-2xl border bg-card p-5"
    >
      <span className="sr-only">Carregando formulário…</span>
      <Skeleton className="mx-auto h-7 w-32" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-full" />
    </div>
  );
}
