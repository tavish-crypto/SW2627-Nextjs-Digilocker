export default function AuthLayout({ children }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8 text-foreground">
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}