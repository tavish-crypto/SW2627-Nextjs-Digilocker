import Link from "next/link";
import { register } from "../actions.js";

export default function Register() {
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Create your vault</h1>
        <p className="mt-2 text-foreground/70">Your password is stored using bcrypt hashing.</p>
      </div>
      <form action={register} className="space-y-4">
        <label className="block space-y-2">
          <span className="text-sm font-medium">Name</span>
          <input className="w-full rounded border border-black/15 px-3 py-2 dark:border-white/20" type="text" name="name" autoComplete="name" />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium">Email</span>
          <input className="w-full rounded border border-black/15 px-3 py-2 dark:border-white/20" type="email" name="email" autoComplete="email" required />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium">Password</span>
          <input className="w-full rounded border border-black/15 px-3 py-2 dark:border-white/20" type="password" name="password" autoComplete="new-password" required minLength={8} />
        </label>
        <button className="w-full rounded bg-foreground px-4 py-2 font-medium text-background" type="submit">Create account</button>
      </form>
      <p className="text-sm text-foreground/70">
        Already registered? <Link className="font-medium underline" href="/login">Sign in</Link>
      </p>
    </section>
  );
}