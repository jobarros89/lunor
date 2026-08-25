export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="dark flex min-h-dvh items-center justify-center bg-[#0b0b0c] px-5 py-8 text-[#f4f3ef]">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
