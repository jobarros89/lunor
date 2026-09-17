import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-6">
      <Card className="w-full max-w-sm">
        <CardContent className="space-y-4 py-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Página não encontrada</h1>
          <p className="text-sm text-muted-foreground">
            O endereço não existe ou você não tem acesso a ele.
          </p>
          <Button
            className="h-12 w-full text-base"
            nativeButton={false}
            render={<Link href="/" />}
          >
            Voltar ao início
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
