import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { EntryDialog } from "@/components/EntryDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import {
  fmtDay,
  fmtHours,
  fmtTime,
  monthLabel,
  monthRange,
  shiftMonth,
  sumMinutes,
  workedMinutes,
} from "@/lib/time";
import type { TimeEntry } from "@/lib/types";

function useTick(active: boolean): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

export function Track() {
  const { member } = useAuth();
  const [month, setMonth] = useState(() => new Date());
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [running, setRunning] = useState<TimeEntry | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TimeEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const now = useTick(!!running);

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
      toast.error("Konnte nicht einstempeln.");
      return;
    }
    toast.success("Eingestempelt – schöne Schicht!");
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
      toast.error("Konnte nicht ausstempeln.");
      return;
    }
    toast.success("Ausgestempelt. Danke!");
    load();
  }

  async function remove(entry: TimeEntry) {
    if (!window.confirm("Diesen Eintrag wirklich löschen?")) return;
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

  return (
    <div className="mx-auto grid max-w-lg gap-6">
      <section className="text-center">
        <h1 className="font-display text-3xl font-semibold">
          Hallo, {member.display_name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {running
            ? `Eingestempelt seit ${fmtTime(running.started_at)} Uhr`
            : "Du bist gerade nicht eingestempelt."}
        </p>
      </section>

      <Card className="border-line bg-paper">
        <CardContent className="flex flex-col items-center gap-5 py-8">
          {running ? (
            <>
              <span className="font-display text-6xl font-semibold tabular-nums text-pine-600">
                {fmtHours(workedMinutes(running, now)).replace(" h", "")}
              </span>
              <Button
                size="lg"
                variant="destructive"
                className="h-14 w-full max-w-xs rounded-full text-lg"
                onClick={clockOut}
                disabled={busy}
              >
                Ausstempeln
              </Button>
            </>
          ) : (
            <Button
              size="lg"
              className="h-16 w-full max-w-xs rounded-full bg-pine-600 text-lg hover:bg-pine-700"
              onClick={clockIn}
              disabled={busy}
            >
              Einstempeln
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" /> Zeit nachtragen
          </Button>
        </CardContent>
      </Card>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMonth((current) => shiftMonth(current, -1))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-36 text-center font-medium">
              {monthLabel(month)}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMonth((current) => shiftMonth(current, 1))}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <Badge variant="secondary" className="text-sm">
            {fmtHours(total)}
          </Badge>
        </div>

        {entries.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Keine Einträge in diesem Monat.
          </p>
        ) : (
          <ul className="grid gap-2">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center gap-3 rounded-xl border border-line bg-card px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {fmtDay(entry.started_at)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {fmtTime(entry.started_at)} –{" "}
                    {entry.ended_at ? fmtTime(entry.ended_at) : "…"}
                    {entry.break_minutes > 0 &&
                      ` · ${entry.break_minutes} min Pause`}
                    {entry.note && ` · ${entry.note}`}
                  </p>
                </div>
                <span className="text-sm font-semibold tabular-nums">
                  {fmtHours(workedMinutes(entry))}
                </span>
                <div className="flex">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditing(entry);
                      setDialogOpen(true);
                    }}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => remove(entry)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
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
      />
    </div>
  );
}
