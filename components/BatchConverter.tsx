import React, { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { InputMode } from '../types';
import { BatchRow, DefaultMode, OUTPUT_COLUMNS, processRows, toOutputRows } from '../utils/batch';

const ACCEPT = '.xlsx,.xls,.xlsm,.csv,.tsv,.txt';
const PREVIEW_LIMIT = 100;

const TEMPLATE_ROWS = [
  { ID: 'ST1', Mesure: 'N45E/45SE', strike: '', dip: '', dipdir: '', quad: '', mode: '' },
  { ID: 'ST2', Mesure: 'S30W/60NW', strike: '', dip: '', dipdir: '', quad: '', mode: '' },
  { ID: 'ST3', Mesure: '120/35SW', strike: '', dip: '', dipdir: '', quad: '', mode: '' },
  { ID: 'ST4', Mesure: '30/135', strike: '', dip: '', dipdir: '', quad: '', mode: 'DipDipDir' },
  { ID: 'ST5', Mesure: '250/70', strike: '', dip: '', dipdir: '', quad: '', mode: 'RHR' },
  { ID: 'ST6', Mesure: '', strike: 80, dip: 25, dipdir: 170, quad: '', mode: '' },
  { ID: 'ST7', Mesure: '', strike: 300, dip: 40, dipdir: '', quad: 'SW', mode: 'Azimuth' },
];

const BatchConverter: React.FC = () => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [columns, setColumns] = useState<string[]>([]);
  const [sourceRows, setSourceRows] = useState<Record<string, unknown>[]>([]);
  const [defaultMode, setDefaultMode] = useState<DefaultMode>('auto');
  const [pasteText, setPasteText] = useState('');
  const [loadError, setLoadError] = useState('');
  const [dragging, setDragging] = useState(false);

  const rows: BatchRow[] = useMemo(
    () => (sourceRows.length ? processRows(sourceRows, columns, defaultMode) : []),
    [sourceRows, columns, defaultMode],
  );
  const okCount = rows.filter(r => r.result.isValid).length;
  const errCount = rows.length - okCount;

  const loadWorkbook = (wb: XLSX.WorkBook, name: string) => {
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
    if (!data.length) {
      setLoadError('The file is empty or has no header row.');
      return;
    }
    const cols = Object.keys(data[0]);
    setColumns(cols);
    setSourceRows(data);
    setFileName(name);
    setLoadError('');
  };

  const readFile = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', raw: false });
      loadWorkbook(wb, file.name);
    } catch (e) {
      setLoadError(`Could not read file: ${(e as Error).message}`);
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) readFile(f);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) readFile(f);
  };

  const handlePaste = () => {
    const lines = pasteText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (!lines.length) return;
    setColumns(['Mesure']);
    setSourceRows(lines.map(l => ({ Mesure: l })));
    setFileName('pasted list');
    setLoadError('');
  };

  const clear = () => {
    setSourceRows([]);
    setColumns([]);
    setFileName('');
    setLoadError('');
  };

  const exportAs = (format: 'xlsx' | 'csv') => {
    const out = toOutputRows(rows, columns);
    const ws = XLSX.utils.json_to_sheet(out, { header: [...columns, ...OUTPUT_COLUMNS] });
    const base = (fileName || 'measurements').replace(/\.[^.]+$/, '') + '_converted';
    if (format === 'csv') {
      const csv = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${base}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const wb = XLSX.utils.book_new();
      ws['!cols'] = [...columns, ...OUTPUT_COLUMNS].map(c => ({ wch: Math.min(Math.max(10, String(c).length + 2), 40) }));
      XLSX.utils.book_append_sheet(wb, ws, 'Conversions');
      XLSX.writeFile(wb, `${base}.xlsx`);
    }
  };

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(TEMPLATE_ROWS);
    ws['!cols'] = [{ wch: 8 }, { wch: 14 }, { wch: 8 }, { wch: 6 }, { wch: 8 }, { wch: 6 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Mesures');
    XLSX.writeFile(wb, 'geostrike_template.xlsx');
  };

  const outputRows = useMemo(() => toOutputRows(rows.slice(0, PREVIEW_LIMIT), columns), [rows, columns]);
  const previewCols = [...columns, ...OUTPUT_COLUMNS.filter(c => c !== 'Input_Mode')];

  return (
    <section className="mt-12 bg-white p-6 md:p-8 rounded-3xl shadow-xl border border-slate-100">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m0 0l-4-4m4 4l4-4" />
              </svg>
            </span>
            Batch Conversion
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Import an Excel / CSV list of measurements, convert them all at once and export the result.
          </p>
        </div>
        <button
          onClick={downloadTemplate}
          className="self-start text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-indigo-600 underline underline-offset-4"
        >
          Download template .xlsx
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Import */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`lg:col-span-2 border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-colors ${
            dragging ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-slate-50'
          }`}
        >
          <input ref={fileRef} type="file" accept={ACCEPT} onChange={handleFile} className="hidden" />
          <button
            onClick={() => fileRef.current?.click()}
            className="py-3 px-6 rounded-xl font-black text-[11px] uppercase tracking-widest bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-200 active:scale-95 transition-all"
          >
            Import Excel / CSV
          </button>
          <p className="mt-3 text-xs text-slate-400 font-medium">or drag &amp; drop a .xlsx / .csv file here</p>
          <p className="mt-4 text-[11px] text-slate-400 leading-relaxed max-w-md">
            Columns recognised: <code className="font-mono text-slate-600">Mesure</code> (e.g. N45E/30SE, 045/30SE, 045/30, 30/135)
            or <code className="font-mono text-slate-600">strike</code> / <code className="font-mono text-slate-600">dip</code> /
            <code className="font-mono text-slate-600"> dipdir</code> / <code className="font-mono text-slate-600">quad</code>,
            optional <code className="font-mono text-slate-600">mode</code>. Other columns are kept in the export.
          </p>
        </div>

        {/* Options + paste */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-600 mb-2">Default input format</label>
            <select
              value={defaultMode}
              onChange={e => setDefaultMode(e.target.value as DefaultMode)}
              className="bg-slate-50 border border-slate-200 text-slate-700 rounded-xl block w-full p-3 font-bold shadow-inner outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="auto">Auto-detect</option>
              {Object.values(InputMode).map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <p className="text-[10px] text-slate-400 mt-1">Used when a row like "045/30" is ambiguous (RHR vs Dip/DipDir).</p>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-600 mb-2">Or paste a list (one per line)</label>
            <textarea
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder={'N45E/45SE\n120/35SW\n30/135'}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-mono h-24 resize-none outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={handlePaste}
              disabled={!pasteText.trim()}
              className={`mt-2 w-full py-2 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all ${
                pasteText.trim() ? 'bg-slate-800 text-white hover:bg-slate-900' : 'bg-slate-100 text-slate-300 cursor-not-allowed'
              }`}
            >
              Convert pasted list
            </button>
          </div>
        </div>
      </div>

      {loadError && (
        <div className="mt-4 bg-rose-50 border-l-4 border-rose-500 p-4 rounded-xl text-sm text-rose-700 font-medium">{loadError}</div>
      )}

      {rows.length > 0 && (
        <div className="mt-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div className="text-sm text-slate-600">
              <span className="font-bold text-slate-800">{fileName}</span> — {rows.length} rows,{' '}
              <span className="font-bold text-emerald-600">{okCount} OK</span>
              {errCount > 0 && <>, <span className="font-bold text-rose-600">{errCount} errors</span></>}
              {rows.length > PREVIEW_LIMIT && <span className="text-slate-400"> (showing first {PREVIEW_LIMIT})</span>}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => exportAs('xlsx')}
                className="py-2 px-4 rounded-xl font-black text-[11px] uppercase tracking-widest bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200 active:scale-95 transition-all"
              >
                Export Excel
              </button>
              <button
                onClick={() => exportAs('csv')}
                className="py-2 px-4 rounded-xl font-black text-[11px] uppercase tracking-widest bg-slate-800 text-white hover:bg-slate-900 active:scale-95 transition-all"
              >
                Export CSV
              </button>
              <button
                onClick={clear}
                className="py-2 px-4 rounded-xl font-black text-[11px] uppercase tracking-widest bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="overflow-auto max-h-[28rem] rounded-2xl border border-slate-200">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-100 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-bold text-slate-500">#</th>
                  {previewCols.map(c => (
                    <th key={c} className="px-3 py-2 text-left font-bold text-slate-500 whitespace-nowrap">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {outputRows.map((r, i) => {
                  const ok = r.Valid === 'OK';
                  return (
                    <tr key={i} className={`border-t border-slate-100 ${ok ? 'bg-white' : 'bg-rose-50'}`}>
                      <td className="px-3 py-1.5 text-slate-400">{i + 1}</td>
                      {previewCols.map(c => (
                        <td
                          key={c}
                          className={`px-3 py-1.5 whitespace-nowrap ${
                            c === 'Valid' ? (ok ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold')
                            : c === 'Error' ? 'text-rose-600'
                            : columns.includes(c) ? 'text-slate-500'
                            : 'font-mono text-slate-800'
                          }`}
                        >
                          {String(r[c] ?? '')}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
};

export default BatchConverter;
