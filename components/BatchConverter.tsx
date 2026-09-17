import React, { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { useT, TKey } from '../i18n';
import {
  BatchFormat, BATCH_FORMATS, BatchRow, OutputGroup, OUTPUT_GROUPS,
  TEMPLATE_COLUMNS, TEMPLATE_EXAMPLES, outputColumnsFor, processRows, toOutputRows,
} from '../utils/batch';

const ACCEPT = '.xlsx,.xls,.xlsm,.csv,.tsv,.txt';
const PREVIEW_LIMIT = 100;

const IconDownload = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v11m0 0l-4-4m4 4l4-4M4 17v2a1 1 0 001 1h14a1 1 0 001-1v-2" />
  </svg>
);
const IconUpload = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15V4m0 0L8 8m4-4l4 4M4 17v2a1 1 0 001 1h14a1 1 0 001-1v-2" />
  </svg>
);
const IconCheck = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const StepHeader: React.FC<{ n: number; title: string; hint: string; done?: boolean }> = ({ n, title, hint, done }) => (
  <div className="flex items-start gap-4 mb-5">
    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm shrink-0 ${
      done ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white'
    }`} aria-hidden="true">
      {done ? <IconCheck /> : n}
    </div>
    <div>
      <h2 className="text-lg font-bold text-slate-900 leading-tight">{title}</h2>
      <p className="text-sm text-slate-500 mt-1 leading-relaxed">{hint}</p>
    </div>
  </div>
);

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <section className={`bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/60 p-6 md:p-8 ${className}`}>{children}</section>
);

const BatchConverter: React.FC = () => {
  const { t } = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const [format, setFormat] = useState<BatchFormat>('strike_sense');
  const [groups, setGroups] = useState<OutputGroup[]>(['quadrant', 'azimuth', 'rhr', 'dipdir', 'numeric', 'illustrator']);
  const [fileName, setFileName] = useState('');
  const [columns, setColumns] = useState<string[]>([]);
  const [sourceRows, setSourceRows] = useState<Record<string, unknown>[]>([]);
  const [pasteText, setPasteText] = useState('');
  const [loadError, setLoadError] = useState('');
  const [dragging, setDragging] = useState(false);

  const rows: BatchRow[] = useMemo(
    () => (sourceRows.length ? processRows(sourceRows, columns, format) : []),
    [sourceRows, columns, format],
  );
  const okCount = rows.filter(r => r.result.isValid).length;
  const errCount = rows.length - okCount;
  const outputCols = useMemo(() => outputColumnsFor(groups), [groups]);

  // ---- file handling ---------------------------------------------------------
  const loadWorkbook = (wb: XLSX.WorkBook, name: string) => {
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
    if (!data.length) { setLoadError(t('empty_file')); return; }
    setColumns(Object.keys(data[0]));
    setSourceRows(data);
    setFileName(name);
    setLoadError('');
  };
  const readFile = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      let wb: XLSX.WorkBook;
      if (/\.(csv|tsv|txt)$/i.test(file.name)) {
        // Text files: UTF-8 when valid (with or without BOM), otherwise Windows-1252 (French Excel "CSV" export).
        let text: string;
        try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf); }
        catch { text = new TextDecoder('windows-1252').decode(buf); }
        wb = XLSX.read(text, { type: 'string', raw: false });
      } else {
        wb = XLSX.read(buf, { type: 'array', raw: false });
      }
      loadWorkbook(wb, file.name);
    } catch (e) {
      setLoadError(`${t('read_error')} ${(e as Error).message}`);
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
    setFormat('auto');
    setColumns(['Mesure']);
    setSourceRows(lines.map(l => ({ Mesure: l })));
    setFileName(t('pasted_list'));
    setLoadError('');
  };
  const clear = () => { setSourceRows([]); setColumns([]); setFileName(''); setLoadError(''); };

  // ---- export ------------------------------------------------------------------
  const exportAs = (kind: 'xlsx' | 'csv') => {
    const out = toOutputRows(rows, columns, outputCols);
    const header = Object.keys(out[0] ?? {});
    const ws = XLSX.utils.json_to_sheet(out, { header });
    const base = (fileName || 'measurements').replace(/\.[^.]+$/, '').replace(/\s+/g, '_') + '_converted';
    if (kind === 'csv') {
      const blob = new Blob(['﻿' + XLSX.utils.sheet_to_csv(ws)], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${base}.csv`; a.click();
      URL.revokeObjectURL(url);
    } else {
      const wb = XLSX.utils.book_new();
      ws['!cols'] = header.map(c => ({ wch: Math.min(Math.max(10, c.length + 2), 40) }));
      XLSX.utils.book_append_sheet(wb, ws, 'Conversions');
      XLSX.writeFile(wb, `${base}.xlsx`);
    }
  };
  const downloadTemplate = () => {
    const cols = TEMPLATE_COLUMNS[format];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(TEMPLATE_EXAMPLES[format], { header: cols });
    ws['!cols'] = cols.map(c => ({ wch: c === 'Commentaire' ? 28 : Math.max(10, c.length + 2) }));
    XLSX.utils.book_append_sheet(wb, ws, 'Mesures');
    XLSX.writeFile(wb, `geostrike_template_${format}.xlsx`);
  };

  const toggleGroup = (g: OutputGroup) =>
    setGroups(prev => (prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]));

  const previewRows = useMemo(() => toOutputRows(rows.slice(0, PREVIEW_LIMIT), columns, outputCols), [rows, columns, outputCols]);
  const previewCols = previewRows.length ? Object.keys(previewRows[0]).filter(c => c !== 'Input_Mode') : [];

  return (
    <div className="space-y-6">
      {/* Step 1 — source format */}
      <Card>
        <StepHeader n={1} title={t('step1')} hint={t('step1_hint')} />
        <div role="radiogroup" aria-label={t('step1')} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {BATCH_FORMATS.map(f => {
            const active = format === f;
            return (
              <button
                key={f}
                role="radio"
                aria-checked={active}
                onClick={() => setFormat(f)}
                className={`text-left rounded-2xl border-2 p-4 transition-all ${
                  active ? 'border-emerald-500 bg-emerald-50/60 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    active ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300'
                  }`} aria-hidden="true">
                    {active && <IconCheck />}
                  </span>
                  <div>
                    <div className="font-bold text-slate-900 text-sm">{t(`bf_${f}` as TKey)}</div>
                    <div className="text-xs text-slate-500 mt-1 leading-relaxed">{t(`bf_${f}_d` as TKey)}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Step 2 — template */}
      <Card>
        <StepHeader n={2} title={t('step2')} hint={t('step2_hint')} />
        <div className="flex flex-col md:flex-row md:items-center gap-5">
          <div className="flex-1">
            <div className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">{t('step2_columns')}</div>
            <div className="flex flex-wrap gap-2">
              {TEMPLATE_COLUMNS[format].map(c => (
                <code key={c} className={`font-mono text-xs px-2.5 py-1.5 rounded-lg border ${
                  c === 'Commentaire' || c === 'ID' ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                }`}>{c}</code>
              ))}
            </div>
          </div>
          <button
            onClick={downloadTemplate}
            className="inline-flex items-center gap-2 py-3 px-5 rounded-xl font-black text-[11px] uppercase tracking-widest bg-slate-900 text-white hover:bg-slate-800 active:scale-95 transition-all shrink-0"
          >
            <IconDownload /> {t('step2_download')}
          </button>
        </div>
      </Card>

      {/* Step 3 — import */}
      <Card>
        <StepHeader n={3} title={t('step3')} hint={t('step3_hint')} done={rows.length > 0} />
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`lg:col-span-3 border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-colors ${
              dragging ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-slate-50'
            }`}
          >
            <input ref={fileRef} type="file" accept={ACCEPT} onChange={handleFile} className="hidden" aria-label={t('step3_button')} />
            <button
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-2 py-3 px-6 rounded-xl font-black text-[11px] uppercase tracking-widest bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-200 active:scale-95 transition-all"
            >
              <IconUpload /> {t('step3_button')}
            </button>
            <p className="mt-3 text-xs text-slate-400 font-medium">{t('step3_drop')}</p>
            {fileName && (
              <p className="mt-4 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-1.5">{fileName}</p>
            )}
          </div>
          <div className="lg:col-span-2">
            <label htmlFor="paste-list" className="block text-sm font-bold text-slate-600 mb-2">{t('step3_paste')}</label>
            <textarea
              id="paste-list"
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder={'N45E/30SE\n120/35SW\n30/135'}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-mono h-28 resize-none outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              onClick={handlePaste}
              disabled={!pasteText.trim()}
              className={`mt-2 w-full py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all ${
                pasteText.trim() ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              {t('step3_paste_btn')}
            </button>
          </div>
        </div>
        {loadError && (
          <div role="alert" className="mt-4 bg-rose-50 border-l-4 border-rose-500 p-4 rounded-xl text-sm text-rose-700 font-medium">{loadError}</div>
        )}
      </Card>

      {/* Step 4 — outputs + export */}
      <Card className={rows.length ? '' : 'opacity-60'}>
        <StepHeader n={4} title={t('step4')} hint={t('step4_hint')} />
        <div className="flex flex-wrap gap-2 mb-6">
          {OUTPUT_GROUPS.map(g => {
            const on = groups.includes(g);
            return (
              <button
                key={g}
                role="checkbox"
                aria-checked={on}
                onClick={() => toggleGroup(g)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-semibold transition-colors ${
                  on ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <span className={`w-4 h-4 rounded border flex items-center justify-center ${on ? 'bg-white/20 border-white/40' : 'border-slate-300'}`} aria-hidden="true">
                  {on && <IconCheck />}
                </span>
                {t(`out_${g}` as TKey)}
              </button>
            );
          })}
        </div>

        {rows.length > 0 && (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div className="text-sm text-slate-600" aria-live="polite">
                <span className="font-bold text-slate-800">{fileName}</span> — {rows.length} {t('rows')},{' '}
                <span className="font-bold text-emerald-700">{okCount} {t('ok')}</span>
                {errCount > 0 && <>, <span className="font-bold text-rose-700">{errCount} {t('errors')}</span></>}
                {rows.length > PREVIEW_LIMIT && <span className="text-slate-400"> ({t('showing_first', { n: PREVIEW_LIMIT })})</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => exportAs('xlsx')} className="inline-flex items-center gap-2 py-2.5 px-4 rounded-xl font-black text-[11px] uppercase tracking-widest bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200 active:scale-95 transition-all">
                  <IconDownload /> {t('export_xlsx')}
                </button>
                <button onClick={() => exportAs('csv')} className="inline-flex items-center gap-2 py-2.5 px-4 rounded-xl font-black text-[11px] uppercase tracking-widest bg-slate-900 text-white hover:bg-slate-800 active:scale-95 transition-all">
                  <IconDownload /> {t('export_csv')}
                </button>
                <button onClick={clear} className="py-2.5 px-4 rounded-xl font-black text-[11px] uppercase tracking-widest bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all">
                  {t('clear')}
                </button>
              </div>
            </div>

            <div className="overflow-auto max-h-[28rem] rounded-2xl border border-slate-200">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-100 sticky top-0 z-10">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left font-bold text-slate-500">#</th>
                    {previewCols.map(c => (
                      <th scope="col" key={c} className={`px-3 py-2 text-left font-bold whitespace-nowrap ${columns.includes(c) ? 'text-slate-500' : 'text-indigo-700'}`}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((r, i) => {
                    const ok = r.Valid === 'OK';
                    return (
                      <tr key={i} className={`border-t border-slate-100 ${ok ? 'bg-white' : 'bg-rose-50'}`}>
                        <td className="px-3 py-1.5 text-slate-400 tabular-nums">{i + 1}</td>
                        {previewCols.map(c => (
                          <td key={c} className={`px-3 py-1.5 whitespace-nowrap ${
                            c === 'Valid' ? (ok ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold')
                            : c === 'Error' ? 'text-rose-700'
                            : columns.includes(c) ? 'text-slate-500'
                            : 'font-mono text-slate-800 tabular-nums'
                          }`}>
                            {String(r[c] ?? '')}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
};

export default BatchConverter;
