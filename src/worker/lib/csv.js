// RFC 4180 CSV with CRLF line ends. Cells that a spreadsheet would read as a formula get a leading single quote.
export function csvCell(value) {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(columns, rows) {
  return [columns, ...rows.map((row) => columns.map((c) => row[c]))].map((cells) => cells.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
