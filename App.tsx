import React from 'react';
import ConverterCard from './components/ConverterCard';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">
              G
            </div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">GeoStrike Converter</h1>
          </div>
          <div className="text-sm text-slate-500 hidden sm:block">
            Universal Structural Converter
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="max-w-5xl mx-auto">
          <div className="mb-10 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Structural Geology Converter</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Select your input format and instantly convert between Quadrant, Azimuth, RHR, and Dip/DipDirection notations.
            </p>
          </div>
          
          <ConverterCard />
          
          {/* Information Section */}
          <div className="mt-16 grid grid-cols-1 md:grid-cols-4 gap-8 text-sm text-slate-600">
             <div>
                <h4 className="font-bold text-slate-900 mb-2">Quadrant</h4>
                <p>N/S θ E/W strike with general quadrant dip direction.</p>
             </div>
             <div>
                <h4 className="font-bold text-slate-900 mb-2">Azimuth</h4>
                <p>0-360° strike with general quadrant dip direction.</p>
             </div>
             <div>
                <h4 className="font-bold text-slate-900 mb-2">RHR</h4>
                <p>Right Hand Rule: Strike is chosen such that dip is to the right.</p>
             </div>
             <div>
                <h4 className="font-bold text-slate-900 mb-2">Dip / DipDir</h4>
                <p>Steepest descent vector defined by Dip Angle and Dip Direction Azimuth.</p>
             </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
