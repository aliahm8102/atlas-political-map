import type { ExportCell, ExportTable } from "./directory-export.ts";

const utf8 = new TextEncoder();
const xml = (value: string) => value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
const ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const rel = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const column = (index: number): string => index < 26 ? String.fromCharCode(65 + index) : column(Math.floor(index / 26) - 1) + column(index % 26);
const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// ZIP's uncompressed storage method keeps this small, offline exporter dependency-free.
function zip(files: Record<string, string>): Uint8Array<ArrayBuffer> {
  const locals: Uint8Array[] = [], central: Uint8Array[] = [];
  let offset = 0, centralSize = 0;
  for (const [path, content] of Object.entries(files)) {
    const name = utf8.encode(path), data = utf8.encode(content), crc = crc32(data);
    const header = new Uint8Array(30 + name.length), view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true); view.setUint16(4, 20, true); view.setUint16(6, 0x800, true);
    view.setUint16(12, 33, true); // 1980-01-01, a valid DOS ZIP date.
    view.setUint32(14, crc, true); view.setUint32(18, data.length, true); view.setUint32(22, data.length, true);
    view.setUint16(26, name.length, true); header.set(name, 30);
    const record = new Uint8Array(46 + name.length), recordView = new DataView(record.buffer);
    recordView.setUint32(0, 0x02014b50, true); recordView.setUint16(4, 20, true); recordView.setUint16(6, 20, true);
    recordView.setUint16(8, 0x800, true); recordView.setUint16(14, 33, true); recordView.setUint32(16, crc, true);
    recordView.setUint32(20, data.length, true); recordView.setUint32(24, data.length, true); recordView.setUint16(28, name.length, true);
    recordView.setUint32(42, offset, true); record.set(name, 46);
    locals.push(header, data); central.push(record); offset += header.length + data.length; centralSize += record.length;
  }
  const end = new Uint8Array(22), view = new DataView(end.buffer);
  view.setUint32(0, 0x06054b50, true); view.setUint16(8, central.length, true); view.setUint16(10, central.length, true);
  view.setUint32(12, centralSize, true); view.setUint32(16, offset, true);
  const result = new Uint8Array(offset + centralSize + end.length);
  let position = 0;
  for (const part of [...locals, ...central, end]) { result.set(part, position); position += part.length; }
  return result;
}

export function xlsxExport(table: ExportTable) {
  const cell = (value: ExportCell, row: number, col: number) => {
    const ref = `${column(col)}${row + 1}`, style = row === 0 ? 1 : 0;
    if (typeof value === "number" && Number.isFinite(value)) return `<c r="${ref}" s="${style}" t="n"><v>${value}</v></c>`;
    // Inline strings cannot become formulas, including names/tags beginning with '='.
    return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value === null ? "" : String(value))}</t></is></c>`;
  };
  const last = `${column(table.headers.length - 1)}${table.rows.length + 1}`;
  const rows = [table.headers, ...table.rows].map((values, row) => `<row r="${row + 1}">${values.map((value, col) => cell(value, row, col)).join("")}</row>`).join("");
  const title = xml(table.title.replace(/[\\/?:*\[\]]/g, " ").slice(0, 31) || "Atlas");
  return zip({
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    "_rels/.rels": `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `<workbook xmlns="${ns}" xmlns:r="${rel}"><sheets><sheet name="${title}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${rel}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${rel}/styles" Target="styles.xml"/></Relationships>`,
    "xl/styles.xml": `<styleSheet xmlns="${ns}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf fontId="0" fillId="0" borderId="0" xfId="0"/><xf fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
    "xl/worksheets/sheet1.xml": `<worksheet xmlns="${ns}"><dimension ref="A1:${last}"/><sheetViews><sheetView workbookViewId="0" rightToLeft="${table.rtl ? 1 : 0}"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${table.headers.map((_, index) => `<col min="${index + 1}" max="${index + 1}" width="25" customWidth="1"/>`).join("")}</cols><sheetData>${rows}</sheetData><autoFilter ref="A1:${last}"/></worksheet>`,
  });
}
