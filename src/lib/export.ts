import { fmtHours, fmtTime, workedMinutes } from "@/lib/time";
import type { Member, TimeEntry } from "@/lib/types";

export type ExportFormat = "csv" | "xlsx" | "pdf" | "json";

type ExportRow = {
  Mitarbeiter: string;
  Datum: string;
  Von: string;
  Bis: string;
  "Pause (min)": number;
  "Netto (h)": string;
  Notiz: string;
};

function toRows(
  entries: TimeEntry[],
  members: Map<string, Member>,
): ExportRow[] {
  return entries
    .filter((entry) => entry.ended_at)
    .map((entry) => ({
      Mitarbeiter: members.get(entry.member_id)?.display_name ?? "?",
      Datum: new Date(entry.started_at).toLocaleDateString("de-DE"),
      Von: fmtTime(entry.started_at),
      Bis: entry.ended_at ? fmtTime(entry.ended_at) : "",
      "Pause (min)": entry.break_minutes,
      "Netto (h)": (workedMinutes(entry) / 60).toFixed(2),
      Notiz: entry.note,
    }));
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function exportEntries(
  fmt: ExportFormat,
  entries: TimeEntry[],
  members: Map<string, Member>,
  label: string,
): Promise<void> {
  const rows = toRows(entries, members);
  const filename = `coco-zeiten-${label}`;

  if (fmt === "json") {
    download(
      new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" }),
      `${filename}.json`,
    );
    return;
  }

  if (fmt === "csv") {
    const header = Object.keys(rows[0] ?? { Mitarbeiter: "" }).join(";");
    const lines = rows.map((row) =>
      Object.values(row)
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(";"),
    );
    download(
      new Blob([`﻿${[header, ...lines].join("\r\n")}`], {
        type: "text/csv;charset=utf-8",
      }),
      `${filename}.csv`,
    );
    return;
  }

  if (fmt === "xlsx") {
    const XLSX = await import("xlsx");
    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet["!cols"] = [
      { wch: 16 },
      { wch: 12 },
      { wch: 7 },
      { wch: 7 },
      { wch: 11 },
      { wch: 10 },
      { wch: 40 },
    ];
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Zeiten");
    XLSX.writeFile(book, `${filename}.xlsx`);
    return;
  }

  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF();
  const totalMinutes = entries
    .filter((entry) => entry.ended_at)
    .reduce((total, entry) => total + workedMinutes(entry), 0);
  doc.setFont("times", "bold");
  doc.setFontSize(18);
  doc.setTextColor("#2d5339");
  doc.text("COCO Munich — Zeiterfassung", 14, 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor("#181b1a");
  doc.text(`Zeitraum: ${label}   ·   Summe: ${fmtHours(totalMinutes)}`, 14, 26);
  autoTable(doc, {
    startY: 32,
    head: [Object.keys(rows[0] ?? { Mitarbeiter: "" })],
    body: rows.map((row) => Object.values(row).map(String)),
    styles: { fontSize: 8 },
    headStyles: { fillColor: "#2d5339" },
    alternateRowStyles: { fillColor: "#f2f6f3" },
  });
  doc.save(`${filename}.pdf`);
}
