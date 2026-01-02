import React, { useMemo } from 'react';

interface CompassProps {
  strike: number;      // RHR Strike (0-360)
  dip: number;         // Dip Angle (0-90)
  dipDirection: number;// Dip Direction Azimuth (0-360)
  isValid: boolean;
}

const Stereonet: React.FC<CompassProps> = ({ strike, dip, dipDirection, isValid }) => {
  // Radius of the primitive circle
  const R = 110; 
  // SVG Center
  const CX = 150;
  const CY = 150;

  // Generate Wulff Net Grid Paths (Memoized)
  const gridPaths = useMemo(() => {
    const paths: React.ReactElement[] = [];
    const gridSteps = [20, 40, 60, 80]; 
    
    gridSteps.forEach(angle => {
      const d = R * Math.tan(((90 - angle) / 2) * (Math.PI / 180));
      const xc = (d * d - R * R) / (2 * d);
      const rc = Math.sqrt(xc * xc + R * R);

      // Great Circles
      paths.push(
        <path 
          key={`gc-e-${angle}`} 
          d={`M ${CX} ${CY - R} A ${rc} ${rc} 0 0 1 ${CX} ${CY + R}`} 
          fill="none" 
          stroke="#475569" 
          strokeWidth="0.5" 
          className="opacity-40"
        />
      );
      paths.push(
        <path 
          key={`gc-w-${angle}`} 
          d={`M ${CX} ${CY - R} A ${rc} ${rc} 0 0 0 ${CX} ${CY + R}`} 
          fill="none" 
          stroke="#475569" 
          strokeWidth="0.5" 
          className="opacity-40"
        />
      );
    });

    return (
        <g>
            {paths}
            <g transform={`rotate(90 ${CX} ${CY})`}>
                {paths}
            </g>
        </g>
    );
  }, [CX, CY, R]);

  // Outer Graduation Ticks & Labels
  const graduations = useMemo(() => {
    const elements: React.ReactElement[] = [];
    for (let i = 0; i < 360; i += 2) {
      const isTen = i % 10 === 0;
      const isCardinal = i % 90 === 0;
      const tickLen = isCardinal ? 10 : (isTen ? 6 : 3);
      const rad = (i - 90) * (Math.PI / 180);
      const x1 = CX + R * Math.cos(rad);
      const y1 = CY + R * Math.sin(rad);
      const x2 = CX + (R + tickLen) * Math.cos(rad);
      const y2 = CY + (R + tickLen) * Math.sin(rad);
      
      elements.push(
        <line 
          key={`tick-${i}`} 
          x1={x1} y1={y1} x2={x2} y2={y2} 
          stroke="#94a3b8" 
          strokeWidth={isCardinal ? 2 : (isTen ? 1.5 : 0.5)} 
        />
      );

      if (isTen) {
        const textDist = R + tickLen + 10;
        const tx = CX + textDist * Math.cos(rad);
        const ty = CY + textDist * Math.sin(rad);
        let label = i.toString().padStart(3, '0');
        let isMain = false;
        if (i === 0) { label = "N"; isMain = true; }
        else if (i === 90) { label = "E"; isMain = true; }
        else if (i === 180) { label = "S"; isMain = true; }
        else if (i === 270) { label = "W"; isMain = true; }
        elements.push(
          <text key={`text-${i}`} x={tx} y={ty} textAnchor="middle" dominantBaseline="middle" fill={isMain ? "#22d3ee" : "#64748b"} className={isMain ? "text-[14px] font-bold" : "text-[8px] font-mono"}>
            {label}
          </text>
        );
      }
    }
    return elements;
  }, [CX, CY, R]);

  if (!isValid) return (
    <div className="w-full aspect-square flex items-center justify-center bg-slate-900 rounded-2xl text-slate-500 border border-slate-700">
      Invalid Geometry
    </div>
  );

  // Plane Arc Path
  let planePath = "";
  if (Math.abs(dip - 90) < 0.1) {
    planePath = `M ${CX} ${CY - R} L ${CX} ${CY + R}`;
  } else if (Math.abs(dip) > 0.1) {
    const d = R * Math.tan(((90 - dip) / 2) * (Math.PI / 180));
    const xc = (d * d - R * R) / (2 * d);
    const rc = Math.sqrt(xc * xc + R * R);
    planePath = `M ${CX} ${CY - R} A ${rc} ${rc} 0 0 1 ${CX} ${CY + R}`;
  }

  // Pole Calculation
  const poleDist = R * Math.tan((dip / 2) * (Math.PI / 180));
  const poleCx = CX - poleDist;
  const poleCy = CY;

  return (
    <div className="relative w-full max-w-[340px] aspect-square mx-auto bg-slate-950 rounded-2xl shadow-2xl border border-slate-800 overflow-hidden">
        {/* Background gradient for depth */}
        <div className="absolute inset-0 bg-gradient-to-tr from-slate-900 to-slate-950 opacity-50"></div>
        
        {/* Legend - Positioned top right, outside the central projection area */}
        <div className="absolute top-4 right-4 z-20">
          <div className="flex flex-col gap-2 bg-slate-900/80 backdrop-blur-md p-2 rounded-lg border border-white/5 shadow-xl">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-1 bg-cyan-400 rounded-full shadow-[0_0_8px_rgba(34,211,238,0.6)]"></div>
              <span className="text-[8px] font-black text-white/60 uppercase tracking-widest">Plane</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-rose-400 rounded-full border border-white/30 shadow-[0_0_8px_rgba(244,63,94,0.6)]"></div>
              <span className="text-[8px] font-black text-white/60 uppercase tracking-widest">Pole</span>
            </div>
          </div>
        </div>

        {/* Stereonet SVG */}
        <svg viewBox="0 0 300 300" className="w-full h-full relative z-10">
            {/* Dark inner circle background */}
            <circle cx={CX} cy={CY} r={R} fill="#0f172a" />
            
            {/* 1. Background Grid (Fixed North Up) */}
            {gridPaths}
            
            {/* 2. Primitive Circle */}
            <circle cx={CX} cy={CY} r={R} fill="none" stroke="#334155" strokeWidth="2" />
            
            {/* 3. Graduations */}
            {graduations}

            {/* 4. Rotated Group (Plane + Pole) */}
            <g transform={`rotate(${strike} ${CX} ${CY})`}>
                {planePath && (
                  <path d={planePath} fill="none" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" className="drop-shadow-[0_0_5px_rgba(34,211,238,0.9)]" />
                )}
                <circle cx={poleCx} cy={poleCy} r="5" fill="#fb7185" stroke="white" strokeWidth="1.5" className="drop-shadow-[0_0_5px_rgba(251,113,133,0.8)]" />
            </g>

            {/* Center Cross */}
            <line x1={CX-5} y1={CY} x2={CX+5} y2={CY} stroke="white" strokeWidth="1" opacity="0.4"/>
            <line x1={CX} y1={CY-5} x2={CX} y2={CY+5} stroke="white" strokeWidth="1" opacity="0.4"/>
        </svg>
    </div>
  );
};

export default Stereonet;