import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";

export function Login() {
  const { signIn } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await signIn(identifier, password);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Anmelden fehlgeschlagen.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-grund md:flex-row">
      <section className="pt-safe relative flex flex-col items-center justify-center bg-mais-400 px-8 py-14 md:w-[46%] md:py-0">
        <img
          src="/brand/logo-stacked-ink.svg"
          alt="COCO Munich"
          className="h-28 w-auto md:h-44"
        />
        <p className="mt-6 text-lg font-medium text-ink/80 md:text-xl">
          Zeiterfassung
        </p>
        <p className="pb-safe absolute bottom-6 hidden text-sm text-ink/60 md:block">
          Barer Straße 68, München
        </p>
      </section>

      <section className="flex flex-1 items-start justify-center px-6 pt-10 pb-16 md:items-center md:pt-0">
        <form onSubmit={submit} className="grid w-full max-w-sm gap-5">
          <div className="mb-2">
            <h1 className="type-display text-3xl">Anmelden</h1>
            <p className="mt-2 text-[15px] text-muted-foreground">
              Mit deinem Benutzernamen und Passwort aus dem Team.
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="identifier">Benutzername oder E-Mail</Label>
            <Input
              id="identifier"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
              spellCheck={false}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Passwort</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <Button type="submit" size="lg" disabled={busy} className="mt-2">
            {busy ? "Anmelden …" : "Anmelden"}
          </Button>
        </form>
      </section>
    </div>
  );
}
