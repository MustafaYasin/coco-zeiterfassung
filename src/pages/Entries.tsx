import { Download, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmProvider";
import { EntryDialog } from "@/components/EntryDialog";
import { MonthSwitcher } from "@/components/MonthSwitcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { type ExportFormat, exportEntries } from "@/lib/export";
import { supabase } from "@/lib/supabase";
import {
  fmtHours,
  fmtTime,
  monthLabel,
  monthRange,
  sumMinutes,
  workedMinutes,
} from "@/lib/time";
import type { Member, TimeEntry } from "@/lib/types";

const ALL = "alle";

export function Entries() {
  const { member: me } = useAuth();
  const confirm = useConfirm();
  const [members, setMembers] = useState<Member[]>([]);
  const [filterMember, setFilterMember] = useState(ALL);
  const [month, setMonth] = useState(() => new Date());
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TimeEntry | null>(null);

  useEffect(() => {
    supabase
      .from("members")
      .select("*")
      .order("display_name")
      .then(({ data }) => setMembers((data as Member[]) ?? []));
  }, []);

  const load = useCallback(async () => {
    const [start, end] = monthRange(month);
    let query = supabase
      .from("time_entries")
      .select("*")
      .gte("started_at", start)
      .lt("started_at", end)
      .order("started_at", { ascending: false });
    if (filterMember !== ALL) query = query.eq("member_id", filterMember);
    const { data } = await query;
    setEntries((data as TimeEntry[]) ?? []);
  }, [month, filterMember]);

  useEffect(() => {
    load();
  }, [load]);

  const memberMap = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members],
  );
  const activeMembers = useMemo(
    () => members.filter((member) => member.active),
    [members],
  );
  const total = sumMinutes(entries);

  async function remove(entry: TimeEntry) {
    const ok = await confirm({
      title: "Eintrag löschen?",
      description: `${memberMap.get(entry.member_id)?.display_name ?? "?"}, ${new Date(entry.started_at).toLocaleDateString("de-DE")}, ${fmtTime(entry.started_at)} bis ${entry.ended_at ? fmtTime(entry.ended_at) : "jetzt"} Uhr.`,
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

  async function doExport(fmt: ExportFormat) {
    if (entries.length === 0) {
      toast.error("Keine Einträge im gewählten Zeitraum.");
      return;
    }
    const who =
      filterMember === ALL
        ? "team"
        : (memberMap.get(filterMember)?.username ?? "mitarbeiter");
    try {
      await exportEntries(
        fmt,
        entries,
        memberMap,
        `${who}-${monthLabel(month)}`,
      );
    } catch (error) {
      // Closing the share sheet without choosing a target is not an error.
      if (error instanceof Error && /cancel/i.test(error.message)) return;
      toast.error("Export hat nicht geklappt.");
    }
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <div>
          <h1 className="type-display text-4xl">Zeiten</h1>
          <p className="mt-1 text-[15px] text-muted-foreground tabular">
            {fmtHours(total)} im {monthLabel(month).split(" ")[0]}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
          <Select value={filterMember} onValueChange={setFilterMember}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Alle Mitarbeiter:innen</SelectItem>
              {members.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.display_name}
                  {member.active ? "" : " (ehemalig)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <MonthSwitcher month={month} onChange={setMonth} />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="size-[18px]" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => doExport("xlsx")}>
                Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => doExport("csv")}>
                CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => doExport("pdf")}>
                PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => doExport("json")}>
                JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-[18px]" /> Eintrag
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">Mitarbeiter:in</TableHead>
              <TableHead>Datum</TableHead>
              <TableHead>Von</TableHead>
              <TableHead>Bis</TableHead>
              <TableHead className="text-right">Pause</TableHead>
              <TableHead className="text-right">Netto</TableHead>
              <TableHead>Notiz</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-10 text-center text-muted-foreground"
                >
                  Keine Einträge in diesem Monat.
                </TableCell>
              </TableRow>
            )}
            {entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="pl-5 font-medium">
                  {memberMap.get(entry.member_id)?.display_name ?? "?"}
                </TableCell>
                <TableCell className="tabular">
                  {new Date(entry.started_at).toLocaleDateString("de-DE")}
                </TableCell>
                <TableCell className="tabular">
                  {fmtTime(entry.started_at)}
                </TableCell>
                <TableCell className="tabular">
                  {entry.ended_at ? (
                    fmtTime(entry.ended_at)
                  ) : (
                    <Badge className="bg-mais-400 text-ink">läuft</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {entry.break_minutes > 0 ? `${entry.break_minutes} min` : "–"}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {entry.ended_at ? fmtHours(workedMinutes(entry)) : "–"}
                </TableCell>
                <TableCell className="max-w-48 truncate text-muted-foreground">
                  {entry.note}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
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
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <EntryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        members={editing ? members : activeMembers}
        defaultMemberId={me?.id ?? activeMembers[0]?.id ?? ""}
        entry={editing}
        onSaved={load}
      />
    </div>
  );
}
