import { startOfWeek } from "date-fns";
import { Download } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { MonthSwitcher } from "@/components/MonthSwitcher";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { exportSummary, type SummaryRow } from "@/lib/export";
import { supabase } from "@/lib/supabase";
import {
  fmtHours,
  monthLabel,
  monthRange,
  sumMinutes,
  workedMinutes,
} from "@/lib/time";
import type { Member, TimeEntry } from "@/lib/types";

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-5 py-5 md:px-6">
      <p className="text-[14px] text-muted-foreground">{label}</p>
      <p className="type-display mt-1 text-3xl tabular">{value}</p>
    </div>
  );
}

function ChartPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-card p-5 md:p-6">
      <h2 className="text-[17px] font-semibold">{title}</h2>
      <div className="mt-4 h-72">{children}</div>
    </section>
  );
}

const axisTick = { fill: "var(--color-stone)", fontSize: 13 };

const tooltipStyle = {
  contentStyle: {
    background: "var(--color-ink)",
    border: "none",
    borderRadius: 12,
    color: "#fbf0d3",
    fontSize: 14,
  },
  itemStyle: { color: "#fbf0d3" },
  labelStyle: { color: "#fbf0d3", opacity: 0.7 },
};

export function Insights() {
  const [month, setMonth] = useState(() => new Date());
  const [members, setMembers] = useState<Member[]>([]);
  const [monthEntries, setMonthEntries] = useState<TimeEntry[]>([]);
  const [recentEntries, setRecentEntries] = useState<TimeEntry[]>([]);
  const [runningCount, setRunningCount] = useState(0);

  useEffect(() => {
    supabase
      .from("members")
      .select("*")
      .then(({ data }) => setMembers((data as Member[]) ?? []));
  }, []);

  useEffect(() => {
    const [start, end] = monthRange(month);
    supabase
      .from("time_entries")
      .select("*")
      .gte("started_at", start)
      .lt("started_at", end)
      .not("ended_at", "is", null)
      .then(({ data }) => setMonthEntries((data as TimeEntry[]) ?? []));
  }, [month]);

  useEffect(() => {
    const since = new Date();
    since.setDate(since.getDate() - 12 * 7);
    supabase
      .from("time_entries")
      .select("*")
      .gte("started_at", since.toISOString())
      .not("ended_at", "is", null)
      .then(({ data }) => setRecentEntries((data as TimeEntry[]) ?? []));
    supabase
      .from("time_entries")
      .select("id", { count: "exact", head: true })
      .is("ended_at", null)
      .then(({ count }) => setRunningCount(count ?? 0));
  }, []);

  const memberMap = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members],
  );

  const perMember = useMemo(() => {
    const minutes = new Map<string, number>();
    for (const entry of monthEntries) {
      minutes.set(
        entry.member_id,
        (minutes.get(entry.member_id) ?? 0) + workedMinutes(entry),
      );
    }
    return [...minutes.entries()]
      .map(([id, mins]) => ({
        name: memberMap.get(id)?.display_name ?? "?",
        stunden: Math.round((mins / 60) * 10) / 10,
      }))
      .sort((a, b) => b.stunden - a.stunden);
  }, [monthEntries, memberMap]);

  // Every active person (also with 0 h) plus former staff who worked this month.
  const summary = useMemo<SummaryRow[]>(() => {
    const totals = new Map<string, { shifts: number; minutes: number }>();
    for (const entry of monthEntries) {
      const current = totals.get(entry.member_id) ?? { shifts: 0, minutes: 0 };
      current.shifts += 1;
      current.minutes += workedMinutes(entry);
      totals.set(entry.member_id, current);
    }
    return members
      .filter((member) => member.active || totals.has(member.id))
      .map((member) => ({
        name: member.display_name,
        former: !member.active,
        shifts: totals.get(member.id)?.shifts ?? 0,
        minutes: totals.get(member.id)?.minutes ?? 0,
      }))
      .sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name));
  }, [monthEntries, members]);

  async function doExport(fmt: "xlsx" | "csv" | "pdf") {
    try {
      await exportSummary(fmt, summary, monthLabel(month));
    } catch (error) {
      // Closing the share sheet without choosing a target is not an error.
      if (error instanceof Error && /cancel/i.test(error.message)) return;
      toast.error("Export hat nicht geklappt.");
    }
  }

  const perWeek = useMemo(() => {
    const minutes = new Map<number, number>();
    for (const entry of recentEntries) {
      const week = startOfWeek(new Date(entry.started_at), { weekStartsOn: 1 });
      const key = week.getTime();
      minutes.set(key, (minutes.get(key) ?? 0) + workedMinutes(entry));
    }
    // Entries arrive unordered; sort weeks chronologically for the chart.
    return [...minutes.entries()]
      .sort(([a], [b]) => a - b)
      .map(([time, mins]) => {
        const week = new Date(time);
        return {
          week: `${week.getDate()}.${week.getMonth() + 1}.`,
          stunden: Math.round(mins / 6) / 10,
        };
      });
  }, [recentEntries]);

  const total = sumMinutes(monthEntries);
  const shiftCount = monthEntries.length;
  const avgShift = shiftCount > 0 ? Math.round(total / shiftCount) : 0;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end gap-4">
        <h1 className="type-display text-4xl">Auswertung</h1>
        <MonthSwitcher month={month} onChange={setMonth} className="ml-auto" />
      </div>

      <div className="grid grid-cols-2 divide-line overflow-hidden rounded-2xl border border-line bg-card max-lg:[&>*:nth-child(-n+2)]:border-b max-lg:[&>*:nth-child(odd)]:border-r lg:grid-cols-4 lg:divide-x">
        <Kpi label="Teamstunden" value={fmtHours(total)} />
        <Kpi label="Schichten" value={String(shiftCount)} />
        <Kpi label="Ø Schicht" value={fmtHours(avgShift)} />
        <Kpi label="Gerade eingestempelt" value={String(runningCount)} />
      </div>

      <section className="overflow-hidden rounded-2xl border border-line bg-card">
        <div className="flex flex-wrap items-center gap-3 px-5 pt-5 pb-3 md:px-6">
          <h2 className="text-[17px] font-semibold">
            Stunden pro Person im {monthLabel(month)}
          </h2>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="ml-auto">
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
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5 md:pl-6">Mitarbeiter:in</TableHead>
              <TableHead className="text-right">Schichten</TableHead>
              <TableHead className="text-right">Stunden</TableHead>
              <TableHead className="pr-5 text-right md:pr-6">
                Ø Schicht
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summary.map((row) => (
              <TableRow key={row.name}>
                <TableCell className="pl-5 font-medium md:pl-6">
                  {row.name}
                  {row.former && (
                    <span className="ml-2 text-[13px] font-normal text-muted-foreground">
                      ehemalig
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular">
                  {row.shifts}
                </TableCell>
                <TableCell
                  className={
                    row.minutes > 0
                      ? "text-right font-semibold tabular"
                      : "text-right text-muted-foreground tabular"
                  }
                >
                  {fmtHours(row.minutes)}
                </TableCell>
                <TableCell className="pr-5 text-right text-muted-foreground tabular md:pr-6">
                  {row.shifts > 0
                    ? fmtHours(Math.round(row.minutes / row.shifts))
                    : "–"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow className="hover:bg-transparent">
              <TableCell className="pl-5 font-semibold md:pl-6">
                Gesamt
              </TableCell>
              <TableCell className="text-right font-semibold tabular">
                {shiftCount}
              </TableCell>
              <TableCell className="text-right font-semibold tabular">
                {fmtHours(total)}
              </TableCell>
              <TableCell className="pr-5 text-right tabular md:pr-6">
                {shiftCount > 0 ? fmtHours(avgShift) : "–"}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartPanel title="Stunden pro Mitarbeiter:in">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={perMember} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid horizontal={false} stroke="var(--border)" />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                tick={axisTick}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={96}
                tickLine={false}
                axisLine={false}
                tick={{ ...axisTick, fill: "var(--color-ink)" }}
              />
              <Tooltip
                formatter={(value) => [`${value} h`, "Stunden"]}
                cursor={{ fill: "var(--color-mais-50)" }}
                {...tooltipStyle}
              />
              <Bar
                dataKey="stunden"
                fill="var(--chart-1)"
                radius={[0, 8, 8, 0]}
                barSize={22}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Teamstunden pro Woche, letzte 12 Wochen">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={perWeek}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="week"
                tickLine={false}
                axisLine={false}
                tick={axisTick}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={axisTick}
                width={40}
              />
              <Tooltip
                formatter={(value) => [`${value} h`, "Stunden"]}
                {...tooltipStyle}
              />
              <Area
                dataKey="stunden"
                stroke="var(--chart-2)"
                fill="var(--chart-1)"
                fillOpacity={0.35}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>
    </div>
  );
}
