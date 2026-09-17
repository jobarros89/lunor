export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="dark flex min-h-dvh items-center justify-center bg-[#0b0b0c] px-4 py-[max(2rem,env(safe-area-inset-top))] text-[#f4f3ef]">
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}
