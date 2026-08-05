import {
  BarChart3,
  KeyRound,
  LogOut,
  Table2,
  Timer,
  UserRound,
  Users,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { NavLink } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/", label: "Erfassen", icon: Timer, admin: false },
  { to: "/insights", label: "Insights", icon: BarChart3, admin: true },
  { to: "/zeiten", label: "Zeiten", icon: Table2, admin: true },
  { to: "/team", label: "Team", icon: Users, admin: true },
];

function PasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (password.length < 6) {
      toast.error("Mindestens 6 Zeichen.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Passwort geändert.");
    setPassword("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">Passwort ändern</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="new-password">Neues Passwort</Label>
          <Input
            id="new-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
          />
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={busy}>
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { member, signOut } = useAuth();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const visibleTabs = tabs.filter((tab) => !tab.admin || member?.is_admin);
  const showNav = visibleTabs.length > 1;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b bg-cream/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-6 px-4">
          <span className="flex items-center gap-2">
            <img
              src="/brand/logo-horizontal-green.svg"
              alt="COCO Munich"
              className="h-7 w-auto"
            />
            <span className="font-display text-lg italic text-pine-600">
              Zeit
            </span>
          </span>

          {showNav && (
            <nav className="hidden gap-1 sm:flex">
              {visibleTabs.map((tab) => (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  className={({ isActive }) =>
                    cn(
                      "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-pine-600 text-cream"
                        : "text-muted-foreground hover:bg-sand",
                    )
                  }
                >
                  {tab.label}
                </NavLink>
              ))}
            </nav>
          )}

          <div className="ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <UserRound className="size-4" />
                  <span className="hidden sm:inline">
                    {member?.display_name}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{member?.display_name}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setPasswordOpen(true)}>
                  <KeyRound className="size-4" /> Passwort ändern
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => signOut()}>
                  <LogOut className="size-4" /> Abmelden
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-24 sm:pb-10">
        {children}
      </main>

      {showNav && (
        <nav className="fixed inset-x-0 bottom-0 z-20 border-t bg-cream/95 backdrop-blur sm:hidden">
          <div
            className="mx-auto flex max-w-md justify-around"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            {visibleTabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({ isActive }) =>
                  cn(
                    "flex flex-col items-center gap-0.5 px-4 py-2 text-[11px] font-medium",
                    isActive ? "text-pine-600" : "text-muted-foreground",
                  )
                }
              >
                <tab.icon className="size-5" />
                {tab.label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}

      <PasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </div>
  );
}
