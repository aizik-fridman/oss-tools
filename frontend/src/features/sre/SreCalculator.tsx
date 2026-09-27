import { useState, useMemo } from 'react';
import { Calculator } from 'lucide-react';
import { Helmet } from 'react-helmet-async';

const TIME_WINDOWS = [
  { label: '24 Hours', hours: 24 },
  { label: '7 Days', hours: 24 * 7 },
  { label: '30 Days', hours: 24 * 30 },
  { label: '90 Days', hours: 24 * 90 },
  { label: '1 Year', hours: 24 * 365.25 }
];

export default function SreCalculator() {
  const [sloStr, setSloStr] = useState('99.9');
  const [windowHours, setWindowHours] = useState(24 * 30);
  
  const [totalReqsStr, setTotalReqsStr] = useState('1000000');
  const [failedReqsStr, setFailedReqsStr] = useState('500');

  const slo = parseFloat(sloStr) || 0;
  const totalReqs = parseInt(totalReqsStr, 10) || 0;
  const failedReqs = parseInt(failedReqsStr, 10) || 0;

  // Error Budget (Time)
  const downtimeBudgetObj = useMemo(() => {
    if (slo <= 0 || slo > 100) return null;
    
    // Exact math for allowed downtime seconds
    const totalSeconds = windowHours * 60 * 60;
    const errorRate = 1 - (slo / 100);
    // Round to nearest integer second to avoid 59.999 floating point issues
    let rem = Math.round(totalSeconds * errorRate);
    
    const d = Math.floor(rem / 86400);
    rem %= 86400;
    const h = Math.floor(rem / 3600);
    rem %= 3600;
    const m = Math.floor(rem / 60);
    const s = rem % 60;

    return { d, h, m, s, totalSec: Math.round(totalSeconds * errorRate) };
  }, [slo, windowHours]);

  // Error Budget (Requests)
  const reqBudgetObj = useMemo(() => {
    if (slo <= 0 || slo > 100 || totalReqs <= 0) return null;
    
    const errorRate = 1 - (slo / 100);
    const allowedFailures = Math.floor(totalReqs * errorRate);
    const currentSli = ((totalReqs - failedReqs) / totalReqs) * 100;
    const remainingBudget = allowedFailures - failedReqs;
    
    return {
      allowedFailures,
      currentSli,
      remainingBudget,
      isExhausted: remainingBudget < 0
    };
  }, [slo, totalReqs, failedReqs]);

  return (
    <div className="h-full overflow-y-auto bg-[#0f172a] text-slate-200 p-8 font-sans">
      <Helmet>
        <title>SRE Calculators (SLO & Error Budget) | Observability Helpers</title>
        <meta name="description" content="Calculate Service Level Objectives (SLOs), Service Level Indicators (SLIs), and Error Budgets instantly in your browser." />
        <meta name="keywords" content="SRE, SLO, SLI, Error Budget, Calculator, Allowed Downtime, Site Reliability Engineering" />
      </Helmet>
      <div className="max-w-4xl mx-auto space-y-12">
        
        {/* Header */}
        <header className="border-b border-slate-800 pb-6 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-normal text-slate-100 flex items-center gap-3 tracking-tight">
              <Calculator className="text-slate-500" size={28} strokeWidth={1.5} />
              SRE Calculator
            </h1>
            <p className="text-slate-400 text-sm mt-2 font-light">
              Service Level Objectives and Error Budget computing.
            </p>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          
          {/* Inputs Column */}
          <div className="space-y-10">
            <section>
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-widest mb-6">Configuration</h2>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Target SLO (%)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={sloStr}
                    onChange={(e) => setSloStr(e.target.value)}
                    className="w-full bg-transparent border-b border-slate-700 py-2 text-2xl text-slate-100 focus:outline-none focus:border-slate-400 transition-colors placeholder-slate-800"
                    placeholder="99.9"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-3">Time Window</label>
                  <div className="flex flex-wrap gap-2">
                    {TIME_WINDOWS.map(w => (
                      <button
                        key={w.label}
                        onClick={() => setWindowHours(w.hours)}
                        className={`px-4 py-1.5 rounded-full text-sm transition-colors border ${windowHours === w.hours ? 'bg-slate-200 text-slate-900 border-slate-200 font-medium' : 'bg-transparent text-slate-400 border-slate-700 hover:border-slate-500'}`}
                      >
                        {w.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-widest mb-6 pt-4 border-t border-slate-800">Volume Metrics</h2>
              
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Total Requests</label>
                  <input 
                    type="number" 
                    value={totalReqsStr}
                    onChange={(e) => setTotalReqsStr(e.target.value)}
                    className="w-full bg-transparent border-b border-slate-700 py-2 text-xl text-slate-100 focus:outline-none focus:border-slate-400 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Failed</label>
                  <input 
                    type="number" 
                    value={failedReqsStr}
                    onChange={(e) => setFailedReqsStr(e.target.value)}
                    className="w-full bg-transparent border-b border-slate-700 py-2 text-xl text-slate-100 focus:outline-none focus:border-slate-400 transition-colors"
                  />
                </div>
              </div>
            </section>
          </div>

          {/* Results Column */}
          <div className="space-y-10 lg:pl-10 lg:border-l border-slate-800">
            <section>
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-widest mb-6">Error Budget (Time)</h2>
              
              <div className="flex items-baseline gap-6">
                <div className="flex flex-col">
                  <span className="text-4xl text-slate-100 font-light">{downtimeBudgetObj?.d || 0}</span>
                  <span className="text-xs text-slate-500 uppercase tracking-wider mt-1">Days</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-4xl text-slate-100 font-light">{downtimeBudgetObj?.h || 0}</span>
                  <span className="text-xs text-slate-500 uppercase tracking-wider mt-1">Hours</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-4xl text-slate-100 font-light">{downtimeBudgetObj?.m || 0}</span>
                  <span className="text-xs text-slate-500 uppercase tracking-wider mt-1">Mins</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-4xl text-slate-100 font-light">{downtimeBudgetObj?.s || 0}</span>
                  <span className="text-xs text-slate-500 uppercase tracking-wider mt-1">Secs</span>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-widest mb-6 pt-4 border-t border-slate-800">Error Budget (Events)</h2>

              {reqBudgetObj && (
                <div className="space-y-8">
                  <div className="flex justify-between items-baseline">
                    <div>
                      <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Current SLI</div>
                      <div className="text-4xl font-light text-slate-100">
                        {reqBudgetObj.currentSli.toFixed(3)}<span className="text-2xl text-slate-500">%</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-8">
                     <div>
                      <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Allowed Failures</div>
                      <div className="text-2xl font-light text-slate-300">{reqBudgetObj.allowedFailures.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className={`text-xs uppercase tracking-wider mb-1 ${reqBudgetObj.isExhausted ? 'text-red-400/80' : 'text-slate-500'}`}>
                        {reqBudgetObj.isExhausted ? 'Budget Exceeded By' : 'Remaining Budget'}
                      </div>
                      <div className={`text-2xl font-light ${reqBudgetObj.isExhausted ? 'text-red-400' : 'text-slate-300'}`}>
                        {Math.abs(reqBudgetObj.remainingBudget).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>

        </div>
      </div>
    </div>
  );
}