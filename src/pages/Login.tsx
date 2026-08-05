import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
        error instanceof Error ? error.message : "Login fehlgeschlagen",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-paper px-4">
      <div className="mb-8 text-center">
        <h1 className="font-display text-5xl font-bold text-pine-600">COCO</h1>
        <p className="mt-1 text-sm tracking-[0.3em] text-muted-foreground uppercase">
          Munich · Zeiterfassung
        </p>
      </div>

      <Card className="w-full max-w-sm border-line shadow-sm">
        <CardContent className="pt-6">
          <form onSubmit={submit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="identifier">Benutzername oder E-Mail</Label>
              <Input
                id="identifier"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="username"
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
        </CardContent>
      </Card>

      <p className="mt-8 text-xs text-muted-foreground">
        Barer Straße 68 · München
      </p>
    </div>
  );
}
