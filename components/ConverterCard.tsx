import React, { useState, useEffect } from 'react';
import { Quadrant, CompassDir, InputMode, PlaneInput } from '../types';
import { calculateConversion } from '../utils/geoMath';
import Compass from './Compass';
import { GoogleGenAI, Type } from "@google/genai";

const ConverterCard: React.FC = () => {
  const [input, setInput] = useState<PlaneInput>({
    mode: InputMode.Quadrant,
    dip: 45,
    quadStart: CompassDir.N,
    quadAngle: 45,
    quadEnd: CompassDir.E,
    quadDipQuad: Quadrant.SE,
    azStrike: 45,
    azDipQuad: Quadrant.SE,
    rhrStrike: 45,
    ddDipDir: 135,
  });

  const [aiText, setAiText] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [result, setResult] = useState(calculateConversion(input));

  useEffect(() => {
    setResult(calculateConversion(input));
  }, [input]);

  const handleChange = <K extends keyof PlaneInput>(key: K, value: any) => {
    if (typeof value === 'number') {
      if (key === 'dip' || key === 'quadAngle') {
         if (value < 0) value = 0;
         if (value > 90) value = 90;
      } else {
         if (value < 0) value = 0;
         if (value > 360) value = 360;
      }
    }
    setInput(prev => ({ ...prev, [key]: value }));
  };

  const handleModeChange = (mode: InputMode) => {
    setInput(prev => ({ ...prev, mode }));
  };

  const handleAiParse = async () => {
    if (!aiText.trim()) return;
    setIsAiLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Convert this structural measurement to JSON: "${aiText}"`,
        config: {
          responseMimeType: "application/json",
          systemInstruction: "You are a professional geologist. Parse the input string into a valid JSON object. Extract strike, dip, and direction. Map to mode: 'Quadrant', 'Azimuth', 'RHR', or 'DipDipDir'. Ensure numerical fields are numbers, not strings. Do not include markdown blocks.",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              mode: { type: Type.STRING },
              dip: { type: Type.NUMBER },
              quadStart: { type: Type.STRING },
              quadAngle: { type: Type.NUMBER },
              quadEnd: { type: Type.STRING },
              quadDipQuad: { type: Type.STRING },
              azStrike: { type: Type.NUMBER },
              azDipQuad: { type: Type.STRING },
              rhrStrike: { type: Type.NUMBER },
              ddDipDir: { type: Type.NUMBER }
            },
            required: ["mode", "dip"]
          }
        }
      });

      // Clean the response: sometimes models include markdown even with responseMimeType
      const rawText = response.text || "";
      const cleanedJson = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
      
      const parsedData = JSON.parse(cleanedJson);
      setInput(prev => ({
        ...prev,
        ...parsedData
      }));
      setAiText(''); 
    } catch (error) {
      console.error("AI Parsing Error:", error);
      alert("Error parsing text. Please try a different format or ensure the input looks like a measurement (e.g., 'N45E 30SE').");
    } finally {
      setIsAiLoading(false);
    }
  };

  const ResultRow = ({ label, value, description, highlight = false }: { label: string, value: string, description: string, highlight?: boolean }) => (
    <div className={`p-4 rounded-xl border ${highlight ? 'bg-indigo-50 border-indigo-200 shadow-sm scale-[1.02]' : 'bg-white border-slate-200'} transition-all duration-300`}>
      <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">{label}</div>
      <div className={`text-2xl font-mono font-bold ${highlight ? 'text-indigo-700' : 'text-slate-800'}`}>
        {value}
      </div>
      <div className="text-xs text-slate-400 mt-1 font-medium italic">{description}</div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
      {/* Left Column: Input */}
      <div className="bg-white p-6 md:p-8 rounded-3xl shadow-xl border border-slate-100 flex flex-col">
        
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            Manual Controls
          </h2>
          <p className="text-sm text-slate-500 mt-1">Fine-tune your measurements</p>
        </div>

        {/* Mode Selector */}
        <div className="flex flex-wrap gap-2 mb-8">
          {Object.values(InputMode).map((m) => (
            <button
              key={m}
              onClick={() => handleModeChange(m)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                input.mode === m 
                  ? 'bg-slate-800 text-white shadow-lg translate-y-[-1px]' 
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="space-y-6 flex-grow">
          {/* Dynamic Form Fields */}
          {input.mode === InputMode.Quadrant && (
            <div className="animate-in fade-in slide-in-from-left-2 duration-300">
              <label className="block text-sm font-bold text-slate-600 mb-3">Strike (Quadrant)</label>
              <div className="flex items-center gap-2 bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-inner">
                <select 
                  value={input.quadStart}
                  onChange={(e) => handleChange('quadStart', e.target.value)}
                  className="bg-white border border-slate-200 text-slate-700 text-sm rounded-xl font-bold p-3 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={CompassDir.N}>N</option>
                  <option value={CompassDir.S}>S</option>
                </select>
                <input 
                  type="number" 
                  value={input.quadAngle}
                  onChange={(e) => handleChange('quadAngle', parseFloat(e.target.value))}
                  min="0" max="90"
                  className="bg-white border border-slate-200 text-slate-800 text-center text-xl rounded-xl w-24 p-2.5 font-mono font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <select 
                  value={input.quadEnd}
                  onChange={(e) => handleChange('quadEnd', e.target.value)}
                  className="bg-white border border-slate-200 text-slate-700 text-sm rounded-xl font-bold p-3 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={CompassDir.E}>E</option>
                  <option value={CompassDir.W}>W</option>
                </select>
              </div>
            </div>
          )}

          {input.mode === InputMode.Azimuth && (
            <div className="animate-in fade-in slide-in-from-left-2 duration-300">
              <label className="block text-sm font-bold text-slate-600 mb-3">Strike Azimuth (0-360°)</label>
              <input 
                type="number" 
                value={input.azStrike}
                onChange={(e) => handleChange('azStrike', parseFloat(e.target.value))}
                min="0" max="360"
                className="bg-slate-50 border border-slate-200 text-slate-800 text-xl rounded-2xl block w-full p-4 font-mono font-bold shadow-inner outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          {input.mode === InputMode.RHR && (
            <div className="animate-in fade-in slide-in-from-left-2 duration-300">
              <label className="block text-sm font-bold text-slate-600 mb-3">RHR Strike (0-360°)</label>
              <input 
                type="number" 
                value={input.rhrStrike}
                onChange={(e) => handleChange('rhrStrike', parseFloat(e.target.value))}
                min="0" max="360"
                className="bg-slate-50 border border-slate-200 text-slate-800 text-xl rounded-2xl block w-full p-4 font-mono font-bold shadow-inner outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          {input.mode === InputMode.DipDipDir && (
             <div className="animate-in fade-in slide-in-from-left-2 duration-300">
               <label className="block text-sm font-bold text-slate-600 mb-3">Dip Direction (0-360°)</label>
               <input 
                 type="number" 
                 value={input.ddDipDir}
                 onChange={(e) => handleChange('ddDipDir', parseFloat(e.target.value))}
                 min="0" max="360"
                 className="bg-slate-50 border border-slate-200 text-slate-800 text-xl rounded-2xl block w-full p-4 font-mono font-bold shadow-inner outline-none focus:ring-2 focus:ring-indigo-500"
               />
             </div>
          )}

          <div className="flex gap-4">
            <div className="flex-1">
               <label className="block text-sm font-bold text-slate-600 mb-3">Dip Angle (0-90°)</label>
               <input 
                type="number" 
                value={input.dip}
                onChange={(e) => handleChange('dip', parseFloat(e.target.value))}
                min="0" max="90"
                className="bg-slate-50 border border-slate-200 text-slate-800 text-xl rounded-2xl block w-full p-4 font-mono font-bold shadow-inner outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            
            {(input.mode === InputMode.Quadrant || input.mode === InputMode.Azimuth) && (
              <div className="flex-1 animate-in zoom-in duration-300">
                <label className="block text-sm font-bold text-slate-600 mb-3">Dip Quadrant</label>
                <select 
                    value={input.mode === InputMode.Quadrant ? input.quadDipQuad : input.azDipQuad}
                    onChange={(e) => handleChange(input.mode === InputMode.Quadrant ? 'quadDipQuad' : 'azDipQuad', e.target.value)}
                    className="bg-slate-50 border border-slate-200 text-slate-700 text-xl rounded-2xl block w-full p-4 font-bold shadow-inner outline-none focus:ring-2 focus:ring-indigo-500"
                >
                    {Object.values(Quadrant).map(q => <option key={q} value={q}>{q}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* AI Quick Parse Section - AT THE BOTTOM */}
        <div className="mt-12 pt-8 border-t border-slate-100">
          <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-1 rounded-[2rem] shadow-2xl overflow-hidden group">
            <div className="bg-white rounded-[1.8rem] p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-sm">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2L14.5 9H22L16 14L18.5 21L12 17L5.5 21L8 14L2 9H9.5L12 2Z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-tighter">Gemini Intelligence</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Natural Text Parsing</p>
                  </div>
                </div>
              </div>

              <div className="relative">
                <textarea
                  value={aiText}
                  onChange={(e) => setAiText(e.target.value)}
                  placeholder="Paste raw text here... (e.g. N12W 45SW)"
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-mono focus:ring-0 focus:border-indigo-200 outline-none transition-all h-24 resize-none placeholder-slate-300"
                />
                <button
                  onClick={handleAiParse}
                  disabled={isAiLoading || !aiText.trim()}
                  className={`absolute bottom-3 right-3 py-2 px-5 rounded-xl font-black text-[11px] uppercase tracking-widest flex items-center gap-2 transition-all duration-300 ${
                    isAiLoading || !aiText.trim()
                      ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200 shadow-lg active:scale-95'
                  }`}
                >
                  {isAiLoading ? (
                    <svg className="animate-spin h-3 w-3 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : 'Parse'}
                </button>
              </div>
              <p className="mt-3 text-[10px] text-center text-slate-400 font-medium">AI will auto-detect formats and fill manual fields above.</p>
            </div>
          </div>
        </div>

        {/* Visualizer Mobile Placement */}
        <div className="mt-8 lg:hidden">
             <Compass strike={result.rhrStrike} dip={result.dip} dipDirection={result.dipDirection} isValid={result.isValid} />
        </div>
      </div>

      {/* Right Column: Results */}
      <div className="space-y-6">
        {result.error && (
            <div className="bg-rose-50 border-l-4 border-rose-500 p-5 rounded-2xl shadow-sm animate-bounce-short">
                <div className="flex items-start">
                    <svg className="h-5 w-5 text-rose-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <div className="ml-3">
                        <p className="text-sm text-rose-800 font-black uppercase tracking-tight">Geometric Constraint Error</p>
                        <p className="text-sm text-rose-600 mt-1 font-medium">{result.error}</p>
                    </div>
                </div>
            </div>
        )}

        <div className="bg-white p-6 md:p-8 rounded-3xl shadow-xl border border-slate-100">
           <h2 className="text-xl font-bold text-slate-800 mb-6">Generated Notations</h2>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <ResultRow 
                 label="Quadrant" 
                 value={result.quadrantNotation} 
                 description="Strike Dip/Quad"
                 highlight={input.mode === InputMode.Quadrant}
               />
               <ResultRow 
                 label="Azimuth" 
                 value={result.azimuthNotation} 
                 description="Az/Dip+Quad"
                 highlight={input.mode === InputMode.Azimuth}
               />
               <ResultRow 
                 label="RHR (Right Hand Rule)" 
                 value={result.rhrNotation} 
                 description="Standard Strike/Dip"
                 highlight={input.mode === InputMode.RHR}
               />
               <ResultRow 
                 label="Dip / DipDir" 
                 value={result.dipDipDirNotation} 
                 description="Vector Notation"
                 highlight={input.mode === InputMode.DipDipDir}
               />
           </div>
        </div>

        {/* Visualizer Desktop Placement */}
        <div className="hidden lg:block bg-slate-900 p-8 rounded-3xl shadow-2xl border border-slate-800 relative group overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-3xl -mr-16 -mt-16 group-hover:bg-indigo-500/20 transition-colors"></div>
            <h3 className="text-sm font-black text-slate-400 mb-6 uppercase tracking-[0.2em] relative z-10">Stereographic Projection</h3>
            <div className="relative z-10 scale-110">
              <Compass strike={result.rhrStrike} dip={result.dip} dipDirection={result.dipDirection} isValid={result.isValid} />
            </div>
            <div className="mt-8 text-center relative z-10">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest max-w-[200px] mx-auto leading-relaxed">
                Equal Angle (Wulff) projection • Lower Hemisphere
              </p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ConverterCard;