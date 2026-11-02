import {
  ChartColumn,
  ChevronsUpDown,
  KeyRound,
  LogOut,
  Table2,
  Timer,
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
  { to: "/insights", label: "Auswertung", icon: ChartColumn, admin: true },
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
      toast.error("Das Passwort braucht mindestens 6 Zeichen.");
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
          <DialogTitle>Passwort ändern</DialogTitle>
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
            Passwort ändern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Initial({ name }: { name: string }) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-mais-400 text-[15px] font-semibold text-ink">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function UserMenu({
  compact,
  onPassword,
}: {
  compact?: boolean;
  onPassword: () => void;
}) {
  const { member, signOut } = useAuth();
  const name = member?.display_name ?? "";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-3 rounded-2xl p-1.5 text-left outline-none transition-colors hover:bg-sand focus-visible:ring-[3px] focus-visible:ring-ring/50",
            !compact && "w-full pr-3",
          )}
        >
          <Initial name={name} />
          {!compact && (
            <>
              <span className="min-w-0 flex-1 truncate text-[15px] font-medium">
                {name}
              </span>
              <ChevronsUpDown className="size-4 text-muted-foreground" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel className="text-[15px]">{name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onPassword}>
          <KeyRound className="size-4" /> Passwort ändern
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => signOut()}>
          <LogOut className="size-4" /> Abmelden
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { member } = useAuth();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const visibleTabs = tabs.filter((tab) => !tab.admin || member?.is_admin);
  const showNav = visibleTabs.length > 1;
  const openPassword = () => setPasswordOpen(true);

  return (
    <div className="flex min-h-dvh">
      {showNav && (
        <aside className="pt-safe pl-safe sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-card md:flex md:w-[92px] lg:w-64">
          <div className="flex h-20 items-center justify-center lg:justify-start lg:px-6">
            <img
              src="/brand/icon-ink.svg"
              alt="COCO Munich"
              className="size-10 lg:hidden"
            />
            <img
              src="/brand/logo-horizontal-ink.svg"
              alt="COCO Munich"
              className="hidden h-8 w-auto lg:block"
            />
          </div>
          <nav className="grid gap-1 px-3 pt-4">
            {visibleTabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end
                className={({ isActive }) =>
                  cn(
                    "flex flex-col items-center gap-1 rounded-2xl px-2 py-2.5 text-xs font-medium transition-colors lg:flex-row lg:gap-3 lg:px-4 lg:py-3 lg:text-[15px]",
                    isActive
                      ? "bg-mais-400 text-ink"
                      : "text-muted-foreground hover:bg-sand hover:text-foreground",
                  )
                }
              >
                <tab.icon className="size-[22px] lg:size-5" strokeWidth={1.9} />
                {tab.label}
              </NavLink>
            ))}
          </nav>
          <div className="pb-safe mt-auto flex justify-center p-3 lg:block">
            <div className="hidden lg:block">
              <UserMenu onPassword={openPassword} />
            </div>
            <div className="lg:hidden">
              <UserMenu compact onPassword={openPassword} />
            </div>
          </div>
        </aside>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className={cn(
            "pt-safe sticky top-0 z-20 border-b border-line bg-grund/90 backdrop-blur-md",
            showNav && "md:hidden",
          )}
        >
          <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-4 px-5">
            <img
              src="/brand/logo-horizontal-ink.svg"
              alt="COCO Munich"
              className="h-7 w-auto"
            />
            <div className="ml-auto">
              <UserMenu compact onPassword={openPassword} />
            </div>
          </div>
        </header>

        <main
          className={cn(
            "mx-auto w-full max-w-5xl flex-1 px-5 pt-6 pb-10 md:px-8 md:pt-10 lg:px-10",
            showNav && "pb-28 md:pb-10",
          )}
        >
          {children}
        </main>
      </div>

      {showNav && (
        <nav className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card/95 backdrop-blur-md md:hidden">
          <div className="mx-auto flex max-w-md justify-around px-2 pt-1.5">
            {visibleTabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end
                className={({ isActive }) =>
                  cn(
                    "flex min-w-16 flex-col items-center gap-1 rounded-2xl px-3 py-1.5 text-[11px] font-medium",
                    isActive ? "text-ink" : "text-muted-foreground",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={cn(
                        "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                        isActive && "bg-mais-400",
                      )}
                    >
                      <tab.icon className="size-5" strokeWidth={1.9} />
                    </span>
                    {tab.label}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      )}

      <PasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </div>
  );
}
