import { Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmProvider";
import { EntryDialog } from "@/components/EntryDialog";
import { MonthSwitcher } from "@/components/MonthSwitcher";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { haptic } from "@/lib/native";
import { supabase } from "@/lib/supabase";
import {
  elapsedParts,
  fmtDayParts,
  fmtHours,
  fmtTime,
  fmtToday,
  monthRange,
  sumMinutes,
  workedMinutes,
} from "@/lib/time";
import type { TimeEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

function useTick(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function Track() {
  const { member } = useAuth();
  const confirm = useConfirm();
  const [month, setMonth] = useState(() => new Date());
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [running, setRunning] = useState<TimeEntry | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TimeEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const now = useTick();

  const load = useCallback(async () => {
    if (!member) return;
    const [start, end] = monthRange(month);
    const [monthResult, runningResult] = await Promise.all([
      supabase
        .from("time_entries")
        .select("*")
        .eq("member_id", member.id)
        .gte("started_at", start)
        .lt("started_at", end)
        .not("ended_at", "is", null)
        .order("started_at", { ascending: false }),
      supabase
        .from("time_entries")
        .select("*")
        .eq("member_id", member.id)
        .is("ended_at", null)
        .maybeSingle(),
    ]);
    setEntries((monthResult.data as TimeEntry[]) ?? []);
    setRunning((runningResult.data as TimeEntry | null) ?? null);
    setLoaded(true);
  }, [member, month]);

  useEffect(() => {
    load();
  }, [load]);

  if (!member) return null;

  async function clockIn() {
    setBusy(true);
    const { error } = await supabase.from("time_entries").insert({
      member_id: member?.id,
      started_at: new Date().toISOString(),
    });
    setBusy(false);
    if (error) {
      toast.error("Einstempeln hat nicht geklappt. Bitte noch einmal tippen.");
      return;
    }
    haptic();
    toast.success("Eingestempelt. Schöne Schicht!");
    load();
  }

  async function clockOut() {
    if (!running) return;
    setBusy(true);
    const { error } = await supabase
      .from("time_entries")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", running.id);
    setBusy(false);
    if (error) {
      toast.error("Ausstempeln hat nicht geklappt. Bitte noch einmal tippen.");
      return;
    }
    haptic();
    toast.success("Ausgestempelt. Danke!");
    load();
  }

  async function remove(entry: TimeEntry) {
    const ok = await confirm({
      title: "Eintrag löschen?",
      description: `${fmtDayParts(entry.started_at).join(" ")}, ${fmtTime(entry.started_at)} bis ${entry.ended_at ? fmtTime(entry.ended_at) : "jetzt"} Uhr.`,
      action: "Löschen",
      destructive: true,
    });
    if (!ok) return;
    const { error } = await supabase
      .from("time_entries")
      .delete()
      .eq("id", entry.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Eintrag gelöscht.");
    load();
  }

  const total = sumMinutes(entries);
  const [hours, minutes, seconds] = running
    ? elapsedParts(running, now)
    : [0, "00", "00"];
  const clock = running
    ? null
    : [
        String(now.getHours()).padStart(2, "0"),
        String(now.getMinutes()).padStart(2, "0"),
      ];

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-start lg:gap-10">
      <div className="grid gap-6">
        <div>
          <p className="text-[15px] text-muted-foreground">{fmtToday(now)}</p>
          <h1 className="type-display mt-1 text-4xl md:text-5xl">
            Hallo, {member.display_name}
          </h1>
        </div>

        <section
          aria-live="polite"
          className={cn(
            "relative overflow-hidden rounded-[2rem] p-7 transition-colors duration-500 md:p-9",
            running ? "bg-mais-400 text-ink" : "border border-line bg-card",
          )}
        >
          {running ? (
            <>
              <p className="text-[17px] font-medium">
                Im Dienst seit {fmtTime(running.started_at)} Uhr
              </p>
              <p className="type-clock mt-6 flex items-baseline text-[5.5rem] md:text-[7.5rem]">
                <span>{hours}</span>
                <span className="px-1 opacity-50">:</span>
                <span>{minutes}</span>
                <span className="ml-3 text-[0.38em] tracking-normal opacity-55">
                  {seconds}
                </span>
              </p>
              <p className="mt-2 text-[15px] text-ink/70">in dieser Schicht</p>
              <Button
                size="lg"
                className="mt-8 h-16 w-full rounded-full bg-ink text-lg text-mais-100 hover:bg-ink/90"
                onClick={clockOut}
                disabled={busy}
              >
                Ausstempeln
              </Button>
            </>
          ) : (
            <>
              <p className="text-[17px] font-medium text-muted-foreground">
                {loaded
                  ? "Du bist gerade nicht eingestempelt."
                  : "Einen Moment …"}
              </p>
              <p className="type-clock mt-6 flex items-baseline text-[5.5rem] text-ink md:text-[7.5rem]">
                <span>{clock?.[0]}</span>
                <span className="px-1 opacity-30">:</span>
                <span>{clock?.[1]}</span>
              </p>
              <p className="mt-2 text-[15px] text-muted-foreground">Uhr</p>
              <Button
                size="lg"
                variant="mais"
                className="mt-8 h-16 w-full rounded-full text-lg"
                onClick={clockIn}
                disabled={busy || !loaded}
              >
                Einstempeln
              </Button>
            </>
          )}
        </section>

        <Button
          variant="ghost"
          className="justify-self-start text-muted-foreground"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="size-5" /> Zeit nachtragen
        </Button>
      </div>

      <section className="grid gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[15px] text-muted-foreground">Deine Stunden</p>
            <p className="type-display mt-0.5 text-3xl tabular">
              {fmtHours(total)}
            </p>
          </div>
          <MonthSwitcher month={month} onChange={setMonth} />
        </div>

        {entries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line px-6 py-12 text-center">
            <p className="text-[15px] text-muted-foreground">
              Keine Schichten in diesem Monat.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
            {entries.map((entry) => {
              const [weekday, day] = fmtDayParts(entry.started_at);
              return (
                <li key={entry.id} className="flex items-center md:pr-2">
                  <button
                    type="button"
                    aria-label={`${weekday} ${day} bearbeiten`}
                    className="flex min-w-0 flex-1 items-center gap-3 py-3 pr-4 pl-4 text-left outline-none transition-colors hover:bg-mais-50 focus-visible:bg-mais-50 active:bg-mais-100 sm:gap-4 md:pr-2"
                    onClick={() => {
                      setEditing(entry);
                      setDialogOpen(true);
                    }}
                  >
                    <div className="w-12 shrink-0">
                      <p className="text-[13px] text-muted-foreground">
                        {weekday}
                      </p>
                      <p className="text-[15px] font-semibold tabular">{day}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] whitespace-nowrap tabular">
                        {fmtTime(entry.started_at)} bis{" "}
                        {entry.ended_at ? fmtTime(entry.ended_at) : "…"}
                      </p>
                      {(entry.break_minutes > 0 || entry.note) && (
                        <p className="truncate text-[13px] text-muted-foreground">
                          {[
                            entry.break_minutes > 0 &&
                              `${entry.break_minutes} min Pause`,
                            entry.note,
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                      )}
                    </div>
                    <span className="text-[15px] font-semibold whitespace-nowrap tabular">
                      {fmtHours(workedMinutes(entry))}
                    </span>
                  </button>
                  <div className="hidden md:flex">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Bearbeiten"
                      onClick={() => {
                        setEditing(entry);
                        setDialogOpen(true);
                      }}
                    >
                      <Pencil className="size-[18px]" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Löschen"
                      className="text-destructive hover:text-destructive"
                      onClick={() => remove(entry)}
                    >
                      <Trash2 className="size-[18px]" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <EntryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        members={[member]}
        defaultMemberId={member.id}
        entry={editing}
        onSaved={load}
        onDelete={(entry) => {
          setDialogOpen(false);
          remove(entry);
        }}
      />
    </div>
  );
}
