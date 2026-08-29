import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: isPlatformAdmin } = await supabase.rpc("is_platform_admin");
    if (isPlatformAdmin) redirect("/painel");

    const { data: membership } = await supabase
      .from("church_members")
      .select("churches(slug)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    const slug = (membership?.churches as unknown as { slug: string } | null)?.slug;
    redirect(slug ? `/${slug}` : "/comecar");
  }

  return <PublicEntry />;
}

function PublicEntry() {
  return (
    <main className="flex min-h-dvh flex-col bg-black text-white">
      <section className="flex flex-1 items-center justify-center px-6 pb-10 pt-[max(2rem,env(safe-area-inset-top))]">
        <div className="flex -translate-y-4 flex-col items-center sm:-translate-y-2">
          <Image
            src="/icons/lunor-mark-v2.svg"
            alt="LUNOR"
            width={220}
            height={220}
            priority
            className="h-auto w-[42vw] max-w-[220px] min-w-[154px]"
          />
          <p className="mt-5 text-[clamp(2rem,8vw,3.5rem)] font-light tracking-[0.32em] text-white [text-indent:0.32em]">
            LUNOR
          </p>
        </div>
      </section>

      <div className="border-t border-white/15 px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-8 text-center">
        <Link
          href="/login"
          className="inline-flex min-h-12 items-center justify-center px-8 text-xl font-medium text-[#8d73ff] underline decoration-1 underline-offset-4 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8d73ff] focus-visible:ring-offset-4 focus-visible:ring-offset-black"
        >
          Log in
        </Link>
      </div>
    </main>
  );
}
