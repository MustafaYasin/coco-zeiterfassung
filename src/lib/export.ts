import { saveFile } from "@/lib/native";
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

export async function exportEntries(
  fmt: ExportFormat,
  entries: TimeEntry[],
  members: Map<string, Member>,
  label: string,
): Promise<void> {
  const rows = toRows(entries, members);
  const filename = `coco-zeiten-${label}`;

  if (fmt === "json") {
    await saveFile(
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
    await saveFile(
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
    const bytes = XLSX.write(book, { type: "array", bookType: "xlsx" });
    await saveFile(
      new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      `${filename}.xlsx`,
    );
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
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor("#1f1c17");
  doc.text("COCO Munich Zeiterfassung", 14, 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor("#6e685d");
  doc.text(`Zeitraum: ${label}   ·   Summe: ${fmtHours(totalMinutes)}`, 14, 26);
  autoTable(doc, {
    startY: 32,
    head: [Object.keys(rows[0] ?? { Mitarbeiter: "" })],
    body: rows.map((row) => Object.values(row).map(String)),
    styles: { fontSize: 8 },
    headStyles: { fillColor: "#1f1c17", textColor: "#fbf0d3" },
    alternateRowStyles: { fillColor: "#fdf8ec" },
  });
  await saveFile(doc.output("blob"), `${filename}.pdf`);
}

/** One line of the monthly per-person summary. */
export type SummaryRow = {
  name: string;
  former: boolean;
  shifts: number;
  minutes: number;
};

/** Monthly totals per person (Excel, CSV or PDF), with a total line. */
export async function exportSummary(
  fmt: Exclude<ExportFormat, "json">,
  summary: SummaryRow[],
  label: string,
): Promise<void> {
  const line = (name: string, shifts: number, minutes: number) => ({
    Mitarbeiter: name,
    Schichten: shifts,
    Stunden: fmtHours(minutes).replace(" h", ""),
    "Stunden (dezimal)": (minutes / 60).toFixed(2),
    "Ø Schicht":
      shifts > 0
        ? fmtHours(Math.round(minutes / shifts)).replace(" h", "")
        : "",
  });
  const totalMinutes = summary.reduce((sum, row) => sum + row.minutes, 0);
  const totalShifts = summary.reduce((sum, row) => sum + row.shifts, 0);
  const rows = [
    ...summary.map((row) =>
      line(
        row.former ? `${row.name} (ehemalig)` : row.name,
        row.shifts,
        row.minutes,
      ),
    ),
    line("Gesamt", totalShifts, totalMinutes),
  ];
  const filename = `coco-stunden-${label}`;

  if (fmt === "csv") {
    const header = Object.keys(rows[0]).join(";");
    const lines = rows.map((row) =>
      Object.values(row)
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(";"),
    );
    await saveFile(
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
      { wch: 24 },
      { wch: 10 },
      { wch: 9 },
      { wch: 16 },
      { wch: 10 },
    ];
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Stunden");
    const bytes = XLSX.write(book, { type: "array", bookType: "xlsx" });
    await saveFile(
      new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      `${filename}.xlsx`,
    );
    return;
  }

  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor("#1f1c17");
  doc.text("COCO Munich Stunden pro Person", 14, 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor("#6e685d");
  doc.text(`Monat: ${label}`, 14, 26);
  autoTable(doc, {
    startY: 32,
    head: [Object.keys(rows[0])],
    body: rows.map((row) => Object.values(row).map(String)),
    styles: { fontSize: 10 },
    headStyles: { fillColor: "#1f1c17", textColor: "#fbf0d3" },
    alternateRowStyles: { fillColor: "#fdf8ec" },
    didParseCell: (cell) => {
      if (cell.section === "body" && cell.row.index === rows.length - 1) {
        cell.cell.styles.fontStyle = "bold";
      }
    },
  });
  await saveFile(doc.output("blob"), `${filename}.pdf`);
}
