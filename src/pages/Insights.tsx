import { startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import {
  fmtHours,
  monthLabel,
  monthRange,
  shiftMonth,
  sumMinutes,
  workedMinutes,
} from "@/lib/time";
import type { Member, TimeEntry } from "@/lib/types";

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border-line">
      <CardContent className="py-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">
          {label}
        </p>
        <p className="mt-1 font-display text-2xl font-semibold text-pine-700">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

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

  const perWeek = useMemo(() => {
    const minutes = new Map<string, number>();
    for (const entry of recentEntries) {
      const week = startOfWeek(new Date(entry.started_at), { weekStartsOn: 1 });
      const key = `${week.getDate()}.${week.getMonth() + 1}.`;
      minutes.set(key, (minutes.get(key) ?? 0) + workedMinutes(entry));
    }
    return [...minutes.entries()].map(([week, mins]) => ({
      week,
      stunden: Math.round(mins / 6) / 10,
    }));
  }, [recentEntries]);

  const total = sumMinutes(monthEntries);
  const shiftCount = monthEntries.length;
  const avgShift = shiftCount > 0 ? Math.round(total / shiftCount) : 0;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-semibold">Insights</h1>
        <div className="ml-auto flex items-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMonth((current) => shiftMonth(current, -1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-32 text-center text-sm font-medium">
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
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Teamstunden" value={fmtHours(total)} />
        <Kpi label="Schichten" value={String(shiftCount)} />
        <Kpi label="Ø Schicht" value={fmtHours(avgShift)} />
        <Kpi label="Gerade eingestempelt" value={String(runningCount)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-line">
          <CardHeader>
            <CardTitle className="font-display text-lg">
              Stunden pro Mitarbeiter:in
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perMember} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid horizontal={false} stroke="var(--border)" />
                <XAxis type="number" tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={80}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  formatter={(value) => [`${value} h`, "Stunden"]}
                  cursor={{ fill: "var(--muted)" }}
                />
                <Bar
                  dataKey="stunden"
                  fill="var(--chart-1)"
                  radius={[0, 6, 6, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-line">
          <CardHeader>
            <CardTitle className="font-display text-lg">
              Teamstunden pro Woche (12 Wochen)
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={perWeek}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="week"
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                />
                <YAxis tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip formatter={(value) => [`${value} h`, "Stunden"]} />
                <Area
                  dataKey="stunden"
                  stroke="var(--chart-1)"
                  fill="var(--chart-3)"
                  fillOpacity={0.4}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
