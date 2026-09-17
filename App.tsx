import React, { useEffect, useState } from 'react';
import ConverterCard from './components/ConverterCard';
import BatchConverter from './components/BatchConverter';
import { LangProvider, useT, Lang } from './i18n';

type View = 'home' | 'single' | 'batch';

const viewFromHash = (): View => {
  const h = window.location.hash.replace('#', '');
  return h === 'single' || h === 'batch' ? h : 'home';
};

// --- Icons (Heroicons outline, 24px, stroke 2) -------------------------------
const IconCompass = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.5 8.5l-2.1 5.4-5.4 2.1 2.1-5.4z" />
  </svg>
);
const IconTable = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 6.5A1.5 1.5 0 014.5 5h15A1.5 1.5 0 0121 6.5v11a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 17.5v-11zM3 10h18M3 14h18M9 5v14M15 5v14" />
  </svg>
);
const IconArrow = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6l6 6-6 6" />
  </svg>
);
const IconBack = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m6 6l-6-6 6-6" />
  </svg>
);

// --- Header -------------------------------------------------------------------
const Header: React.FC<{ view: View; go: (v: View) => void }> = ({ view, go }) => {
  const { t, lang, setLang } = useT();
  const tabs: { id: View; label: string }[] = [
    { id: 'home', label: t('nav_home') },
    { id: 'single', label: t('nav_single') },
    { id: 'batch', label: t('nav_batch') },
  ];
  const Tabs = () => (
    <nav className="flex items-center gap-1 bg-slate-100 rounded-xl p-1" aria-label="Main">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => go(tab.id)}
          aria-current={view === tab.id ? 'page' : undefined}
          className={`flex-1 md:flex-none px-3 md:px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${
            view === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
  return (
    <header className="bg-white/90 backdrop-blur border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <button onClick={() => go('home')} className="flex items-center gap-3 shrink-0" aria-label={t('nav_home')}>
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">G</div>
          <div className="text-left">
            <div className="text-base font-bold text-slate-800 tracking-tight leading-tight">GeoStrike Converter</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-widest hidden sm:block">{t('tagline')}</div>
          </div>
        </button>

        <div className="hidden md:block"><Tabs /></div>

        <div className="flex items-center gap-1 text-xs font-bold" role="group" aria-label="Language">
          {(['fr', 'en'] as Lang[]).map(l => (
            <button
              key={l}
              onClick={() => setLang(l)}
              aria-pressed={lang === l}
              className={`px-2.5 py-1.5 rounded-lg uppercase tracking-wider transition-colors ${
                lang === l ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="md:hidden px-4 pb-3"><Tabs /></div>
    </header>
  );
};

// --- Home ---------------------------------------------------------------------
const FeatureCard: React.FC<{
  kicker: string; title: string; desc: string; cta: string; onClick: () => void;
  icon: React.ReactNode; tone: 'indigo' | 'emerald'; bullets: string[];
}> = ({ kicker, title, desc, cta, onClick, icon, tone, bullets }) => {
  const c = tone === 'indigo'
    ? { icon: 'bg-indigo-600', kicker: 'text-indigo-600', btn: 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200', ring: 'hover:border-indigo-300', dot: 'bg-indigo-400' }
    : { icon: 'bg-emerald-600', kicker: 'text-emerald-600', btn: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200', ring: 'hover:border-emerald-300', dot: 'bg-emerald-400' };
  return (
    <article
      onClick={onClick}
      className={`group bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/60 p-7 md:p-8 flex flex-col cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl ${c.ring}`}
    >
      <div className={`w-12 h-12 rounded-2xl ${c.icon} text-white flex items-center justify-center mb-6`}>{icon}</div>
      <div className={`text-[11px] font-black uppercase tracking-[0.2em] ${c.kicker} mb-2`}>{kicker}</div>
      <h3 className="text-2xl font-bold text-slate-900 mb-3 leading-snug">{title}</h3>
      <p className="text-slate-600 leading-relaxed mb-6">{desc}</p>
      <ul className="space-y-2 mb-8 text-sm text-slate-600">
        {bullets.map(b => (
          <li key={b} className="flex items-start gap-2.5">
            <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />
            <span>{b}</span>
          </li>
        ))}
      </ul>
      <button
        onClick={e => { e.stopPropagation(); onClick(); }}
        className={`mt-auto self-start inline-flex items-center gap-2 py-3 px-6 rounded-xl text-white font-black text-[12px] uppercase tracking-widest shadow-lg active:scale-95 transition-all ${c.btn}`}
      >
        {cta} <IconArrow />
      </button>
    </article>
  );
};

const Home: React.FC<{ go: (v: View) => void }> = ({ go }) => {
  const { t, lang } = useT();
  const singleBullets = lang === 'fr'
    ? ['Quadrant, Azimut, RHR, Dip/DipDir', 'Contrôle de cohérence direction / sens de pendage', 'Stéréogramme et angles Illustrator']
    : ['Quadrant, Azimuth, RHR, Dip/DipDir', 'Strike / dip-sense consistency check', 'Stereonet and Illustrator angles'];
  const batchBullets = lang === 'fr'
    ? ['5 modèles selon vos données de départ', 'Colonne Commentaire conservée telle quelle', 'Export Excel ou CSV avec les formats choisis']
    : ['5 templates matching your source data', 'Comment column kept untouched', 'Excel or CSV export with the formats you pick'];

  return (
    <>
      <section className="text-center mb-12 md:mb-16">
        <h1 className="text-3xl md:text-5xl font-bold text-slate-900 tracking-tight mb-4">{t('home_title')}</h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">{t('home_subtitle')}</p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8" aria-label="Tools">
        <FeatureCard
          tone="indigo" icon={<IconCompass />}
          kicker={t('card_single_kicker')} title={t('card_single_title')} desc={t('card_single_desc')}
          cta={t('card_single_cta')} onClick={() => go('single')} bullets={singleBullets}
        />
        <FeatureCard
          tone="emerald" icon={<IconTable />}
          kicker={t('card_batch_kicker')} title={t('card_batch_title')} desc={t('card_batch_desc')}
          cta={t('card_batch_cta')} onClick={() => go('batch')} bullets={batchBullets}
        />
      </section>

      <section className="mt-16 md:mt-20">
        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-6 text-center">{t('formats_title')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-slate-600">
          {[
            ['Quadrant', 'N45E/30SE', t('fmt_quadrant')],
            ['Azimuth', '045/30SE', t('fmt_azimuth')],
            ['RHR', '045/30', t('fmt_rhr')],
            ['Dip / DipDir', '30/135', t('fmt_dipdir')],
          ].map(([name, ex, desc]) => (
            <div key={name} className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-baseline justify-between mb-2">
                <h4 className="font-bold text-slate-900">{name}</h4>
                <code className="font-mono text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">{ex}</code>
              </div>
              <p className="leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
};

// --- Page shell for sub-views ------------------------------------------------
const SubPage: React.FC<{ title: string; subtitle?: string; go: (v: View) => void; children: React.ReactNode }> = ({ title, subtitle, go, children }) => {
  const { t } = useT();
  return (
    <>
      <div className="mb-8">
        <button onClick={() => go('home')} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-indigo-600 mb-4">
          <IconBack /> {t('back_home')}
        </button>
        <h1 className="text-2xl md:text-4xl font-bold text-slate-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-slate-600 mt-2 text-lg">{subtitle}</p>}
      </div>
      {children}
    </>
  );
};

const Shell: React.FC = () => {
  const { t } = useT();
  const [view, setView] = useState<View>(viewFromHash);

  useEffect(() => {
    const onHash = () => setView(viewFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = (v: View) => {
    window.location.hash = v === 'home' ? '' : v;
    setView(v);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <Header view={view} go={go} />
      <main id="main" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="max-w-5xl mx-auto">
          {view === 'home' && <Home go={go} />}
          {view === 'single' && (
            <SubPage title={t('single_title')} go={go}>
              <ConverterCard />
            </SubPage>
          )}
          {view === 'batch' && (
            <SubPage title={t('batch_title')} subtitle={t('batch_subtitle')} go={go}>
              <BatchConverter />
            </SubPage>
          )}
        </div>
      </main>
    </div>
  );
};

const App: React.FC = () => (
  <LangProvider>
    <Shell />
  </LangProvider>
);

export default App;
