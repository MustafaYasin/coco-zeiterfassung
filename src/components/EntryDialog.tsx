import { format } from "date-fns";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { combineDateTime } from "@/lib/time";
import type { Member, TimeEntry } from "@/lib/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Admin mode: choose any member. Member mode: pass exactly the own member. */
  members: Member[];
  defaultMemberId: string;
  entry: TimeEntry | null;
  onSaved: () => void;
  /** Shows a delete button while editing (used on small screens). */
  onDelete?: (entry: TimeEntry) => void;
};

export function EntryDialog({
  open,
  onOpenChange,
  members,
  defaultMemberId,
  entry,
  onSaved,
  onDelete,
}: Props) {
  const [memberId, setMemberId] = useState(defaultMemberId);
  const [date, setDate] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [breakMinutes, setBreakMinutes] = useState("0");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (entry) {
      const start = new Date(entry.started_at);
      setMemberId(entry.member_id);
      setDate(format(start, "yyyy-MM-dd"));
      setFrom(format(start, "HH:mm"));
      setTo(entry.ended_at ? format(new Date(entry.ended_at), "HH:mm") : "");
      setBreakMinutes(String(entry.break_minutes));
      setNote(entry.note);
    } else {
      setMemberId(defaultMemberId);
      setDate(format(new Date(), "yyyy-MM-dd"));
      setFrom("18:00");
      setTo("23:00");
      setBreakMinutes("0");
      setNote("");
    }
  }, [open, entry, defaultMemberId]);

  async function save() {
    if (!date || !from || !to) {
      toast.error("Bitte Datum, Von und Bis ausfüllen.");
      return;
    }
    const started = combineDateTime(date, from);
    const ended = combineDateTime(date, to);
    if (ended <= started) ended.setDate(ended.getDate() + 1); // over midnight

    setBusy(true);
    const payload = {
      member_id: memberId,
      started_at: started.toISOString(),
      ended_at: ended.toISOString(),
      break_minutes: Math.max(0, Number(breakMinutes) || 0),
      note: note.trim(),
    };
    const query = entry
      ? supabase.from("time_entries").update(payload).eq("id", entry.id)
      : supabase.from("time_entries").insert(payload);
    const { error } = await query;
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(entry ? "Eintrag aktualisiert." : "Eintrag gespeichert.");
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {entry ? "Eintrag bearbeiten" : "Zeit nachtragen"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          {members.length > 1 && (
            <div className="grid gap-2">
              <Label>Mitarbeiter:in</Label>
              <Select value={memberId} onValueChange={setMemberId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="entry-date">Datum</Label>
            <Input
              id="entry-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="entry-from">Von</Label>
              <Input
                id="entry-from"
                type="time"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="entry-to">Bis</Label>
              <Input
                id="entry-to"
                type="time"
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </div>
            <div className="col-span-2 grid gap-2 sm:col-span-1">
              <Label htmlFor="entry-break">Pause (min)</Label>
              <Input
                id="entry-break"
                type="number"
                min={0}
                inputMode="numeric"
                value={breakMinutes}
                onChange={(event) => setBreakMinutes(event.target.value)}
              />
            </div>
          </div>

          {from && to && to <= from && (
            <p className="-mt-1 text-[13px] text-muted-foreground">
              Endet am nächsten Tag (über Mitternacht).
            </p>
          )}

          <div className="grid gap-2">
            <Label htmlFor="entry-note">Notiz (optional)</Label>
            <Input
              id="entry-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          {entry && onDelete && (
            <Button
              variant="ghost"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive sm:mr-auto md:hidden"
              onClick={() => onDelete(entry)}
            >
              Löschen
            </Button>
          )}
          <Button onClick={save} disabled={busy} className="sm:min-w-32">
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
