import { KeyRound, Plus, ShieldCheck, Trash2, UserRoundX } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { adminAction } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type { Member } from "@/lib/types";

type DialogMode =
  | { kind: "create" }
  | { kind: "password"; member: Member }
  | { kind: "reactivate"; member: Member }
  | null;

export function Team() {
  const { member: me } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [mode, setMode] = useState<DialogMode>(null);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("members")
      .select("*")
      .order("active", { ascending: false })
      .order("display_name");
    setMembers((data as Member[]) ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setUsername("");
    setDisplayName("");
    setEmail("");
    setPassword("");
    setIsAdmin(false);
    setMode({ kind: "create" });
  }

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true);
    try {
      await action();
      toast.success(success);
      setMode(null);
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  function submitDialog() {
    if (!mode) return;
    if (mode.kind === "create") {
      run(
        () =>
          adminAction({
            action: "create_user",
            username: username.trim().toLowerCase(),
            display_name: displayName.trim() || username.trim(),
            password,
            email: email.trim() || undefined,
            is_admin: isAdmin,
          }),
        "Zugang angelegt.",
      );
    } else if (mode.kind === "password") {
      run(
        () =>
          adminAction({
            action: "set_password",
            member_id: mode.member.id,
            password,
          }),
        "Passwort gesetzt.",
      );
    } else {
      run(
        () =>
          adminAction({
            action: "reactivate",
            member_id: mode.member.id,
            password,
            email: email.trim() || undefined,
          }),
        "Zugang reaktiviert.",
      );
    }
  }

  async function deactivate(target: Member) {
    if (
      !window.confirm(
        `${target.display_name} deaktivieren? Der Login wird entfernt, alle Zeiten bleiben erhalten.`,
      )
    )
      return;
    run(
      () => adminAction({ action: "deactivate", member_id: target.id }),
      "Zugang deaktiviert.",
    );
  }

  async function hardDelete(target: Member) {
    if (
      !window.confirm(
        `${target.display_name} ENDGÜLTIG löschen? Auch alle Zeiteinträge werden gelöscht!`,
      )
    )
      return;
    if (
      !window.confirm(
        "Wirklich sicher? Das kann nicht rückgängig gemacht werden.",
      )
    )
      return;
    run(
      () => adminAction({ action: "delete_user", member_id: target.id }),
      "Mitglied gelöscht.",
    );
  }

  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-3">
        <h1 className="font-display text-2xl font-semibold">Team</h1>
        <Button size="sm" className="ml-auto" onClick={openCreate}>
          <Plus className="size-4" /> Neuer Zugang
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Benutzername</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.id}>
                <TableCell className="font-medium">
                  {member.display_name}
                  {member.is_admin && (
                    <Badge className="ml-2 bg-pine-600">
                      <ShieldCheck className="size-3" /> Admin
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {member.username}
                </TableCell>
                <TableCell>
                  {member.active ? (
                    <Badge variant="secondary">aktiv</Badge>
                  ) : (
                    <Badge variant="outline">ehemalig</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {member.active ? (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setPassword("");
                          setMode({ kind: "password", member });
                        }}
                      >
                        <KeyRound className="size-4" /> Passwort
                      </Button>
                      {member.id !== me?.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deactivate(member)}
                        >
                          <UserRoundX className="size-4" /> Deaktivieren
                        </Button>
                      )}
                    </>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setPassword("");
                        setEmail("");
                        setMode({ kind: "reactivate", member });
                      }}
                    >
                      <KeyRound className="size-4" /> Reaktivieren
                    </Button>
                  )}
                  {member.id !== me?.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => hardDelete(member)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={mode !== null}
        onOpenChange={(open) => !open && setMode(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">
              {mode?.kind === "create" && "Neuer Zugang"}
              {mode?.kind === "password" &&
                `Passwort für ${mode.member.display_name}`}
              {mode?.kind === "reactivate" &&
                `${mode.member.display_name} reaktivieren`}
            </DialogTitle>
            {mode?.kind === "create" && (
              <DialogDescription>
                Login ist Benutzername + Passwort. E-Mail ist optional.
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="grid gap-4">
            {mode?.kind === "create" && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="team-username">Benutzername</Label>
                  <Input
                    id="team-username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    autoCapitalize="none"
                    placeholder="z. B. maria"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="team-name">Anzeigename</Label>
                  <Input
                    id="team-name"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="z. B. Maria"
                  />
                </div>
              </>
            )}
            {(mode?.kind === "create" || mode?.kind === "reactivate") && (
              <div className="grid gap-2">
                <Label htmlFor="team-email">E-Mail (optional)</Label>
                <Input
                  id="team-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="team-password">Passwort (min. 6 Zeichen)</Label>
              <Input
                id="team-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoCapitalize="none"
              />
            </div>
            {mode?.kind === "create" && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isAdmin}
                  onChange={(event) => setIsAdmin(event.target.checked)}
                  className="size-4 accent-pine-600"
                />
                Admin-Rechte
              </label>
            )}
          </div>

          <DialogFooter>
            <Button onClick={submitDialog} disabled={busy}>
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
