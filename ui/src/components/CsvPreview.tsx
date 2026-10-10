import { Trans } from "react-i18next";
import { t as translateUiCopy, useTranslation as useUiCopyTranslation } from "@/i18n";
import { useMemo } from "react";
import { parseCsv } from "@/lib/csv-preview";

const MAX_VISIBLE_ROWS = 500;
const MAX_VISIBLE_COLUMNS = 100;

export function CsvPreview({ text, title }: { text: string; title: string }) {
  useUiCopyTranslation();
  const parsed = useMemo(() => {
    try { return { rows: parseCsv(text), error: null }; }
    catch (error) { return { rows: [], error: (error as Error).message }; }
  }, [text]);
  if (parsed.error) return <p role="alert" className="p-4 text-sm text-muted-foreground">{parsed.error}</p>;
  if (!parsed.rows.length) return <p className="p-4 text-sm text-muted-foreground">{translateUiCopy("app.upstreamSync.fileIsEmpty")}</p>;
  const [header, ...rows] = parsed.rows;
  const columnCount = parsed.rows.reduce((count, row) => Math.max(count, row.length), 0);
  const columns = Array.from({ length: Math.min(columnCount, MAX_VISIBLE_COLUMNS) }, (_, index) => index);
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2 text-xs text-muted-foreground" role="status">
        <span className="font-medium text-foreground">{translateUiCopy("app.uiCopy.componentsCsvPreview.cSVPreview")}</span>
        <span>{rows.length.toLocaleString()} {rows.length === 1 ? translateUiCopy("app.upstreamSync.row") : translateUiCopy("app.upstreamSync.rows")}</span>
        <span>{columnCount.toLocaleString()} {columnCount === 1 ? translateUiCopy("app.upstreamSync.column") : translateUiCopy("app.upstreamSync.columns")}</span>
        {(rows.length > MAX_VISIBLE_ROWS || columnCount > MAX_VISIBLE_COLUMNS) && <span><Trans i18nKey="app.uiCopy.componentsCsvPreview.message6" components={{ part0: <>{""}{Math.min(rows.length, MAX_VISIBLE_ROWS)}</>, part1: <>{""}{columns.length}</> }} /></span>}
      </div>
      <div className="min-h-0 flex-1 overflow-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset" role="region" aria-label={translateUiCopy("app.uiCopy.componentsCsvPreview.value0CSVTable", { value0: String(title) })} tabIndex={0}>
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{title} {translateUiCopy("app.uiCopy.componentsCsvPreview.firstRecordUsedAsColumnHeaders")}</caption>
          <thead className="sticky top-0 z-10 bg-muted">
            <tr><th scope="col" className="w-10 border-b border-border px-3 py-3 text-right font-mono text-xs text-muted-foreground"><span className="sr-only">{translateUiCopy("app.uiCopy.componentsCsvPreview.row")}</span>#</th>
              {columns.map((column) => <th key={column} scope="col" className="whitespace-nowrap border-b border-border px-4 py-3 text-left font-medium">{header[column] || translateUiCopy("app.uiCopy.componentsCsvPreview.columnValue0", { value0: String(column + 1) })}</th>)}
            </tr>
          </thead>
          <tbody>{rows.slice(0, MAX_VISIBLE_ROWS).map((row, index) => <tr key={index} className="even:bg-muted/30 hover:bg-accent/50">
            <th scope="row" className="border-b border-border/50 px-3 py-2 text-right font-mono text-xs font-normal text-muted-foreground">{index + 1}</th>
            {columns.map((column) => <td key={column} className="whitespace-pre-wrap border-b border-border/50 px-4 py-2 align-top">{row[column] ?? ""}</td>)}
          </tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
