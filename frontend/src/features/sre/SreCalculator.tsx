import { useState, useMemo } from 'react';
import { Calculator, Clock, Activity, Target, AlertTriangle, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';

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
    const totalSeconds = windowHours * 60 * 60;
    const allowedDowntimeSeconds = totalSeconds * ((100 - slo) / 100);
    
    let rem = allowedDowntimeSeconds;
    const d = Math.floor(rem / (24 * 3600));
    rem %= (24 * 3600);
    const h = Math.floor(rem / 3600);
    rem %= 3600;
    const m = Math.floor(rem / 60);
    const s = rem % 60;

    return { d, h, m, s: s.toFixed(1), totalSec: allowedDowntimeSeconds };
  }, [slo, windowHours]);

  // Error Budget (Requests)
  const reqBudgetObj = useMemo(() => {
    if (slo <= 0 || slo > 100 || totalReqs <= 0) return null;
    const allowedFailures = Math.floor(totalReqs * ((100 - slo) / 100));
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
    <div className="h-full overflow-y-auto bg-[#0f172a] text-slate-200 p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="mb-8">
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400 flex items-center gap-3">
            <Calculator className="text-violet-400" size={32} />
            SRE Calculators
          </h1>
          <p className="text-slate-400 mt-2">
            Calculate Error Budgets, Allowed Downtime, and SLIs based on Site Reliability Engineering principles.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Inputs Section */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
            <div className="flex items-center gap-2 text-xl font-bold text-slate-100 border-b border-slate-800 pb-4">
              <Target className="text-sky-400" /> Core SLO Target
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Target SLO (%)</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={sloStr}
                  onChange={(e) => setSloStr(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all font-mono"
                  placeholder="99.9"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Time Window</label>
                <div className="grid grid-cols-3 gap-2">
                  {TIME_WINDOWS.map(w => (
                    <button
                      key={w.label}
                      onClick={() => setWindowHours(w.hours)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${windowHours === w.hours ? 'bg-violet-500/20 text-violet-400 border border-violet-500/50' : 'bg-slate-950 border border-slate-800 text-slate-400 hover:bg-slate-800'}`}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xl font-bold text-slate-100 border-b border-slate-800 pb-4 pt-6">
              <Activity className="text-pink-400" /> SLI / Volume Metrics
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Total Requests</label>
                <input 
                  type="number" 
                  value={totalReqsStr}
                  onChange={(e) => setTotalReqsStr(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Failed Requests</label>
                <input 
                  type="number" 
                  value={failedReqsStr}
                  onChange={(e) => setFailedReqsStr(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all font-mono"
                />
              </div>
            </div>
          </motion.div>

          {/* Results Section */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="space-y-6">
            
            {/* Time Budget */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-32 bg-sky-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
              <div className="flex items-center gap-2 text-lg font-bold text-slate-200 mb-6 relative z-10">
                <Clock className="text-sky-400" /> Allowed Downtime (Error Budget)
              </div>
              
              <div className="grid grid-cols-4 gap-4 relative z-10">
                <div className="bg-slate-950 rounded-xl p-4 text-center border border-slate-800/50">
                  <div className="text-3xl font-black text-slate-200 font-mono mb-1">{downtimeBudgetObj?.d || 0}</div>
                  <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Days</div>
                </div>
                <div className="bg-slate-950 rounded-xl p-4 text-center border border-slate-800/50">
                  <div className="text-3xl font-black text-slate-200 font-mono mb-1">{downtimeBudgetObj?.h || 0}</div>
                  <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Hours</div>
                </div>
                <div className="bg-slate-950 rounded-xl p-4 text-center border border-slate-800/50">
                  <div className="text-3xl font-black text-slate-200 font-mono mb-1">{downtimeBudgetObj?.m || 0}</div>
                  <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Mins</div>
                </div>
                <div className="bg-slate-950 rounded-xl p-4 text-center border border-slate-800/50">
                  <div className="text-3xl font-black text-slate-200 font-mono mb-1">{downtimeBudgetObj?.s || 0}</div>
                  <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Secs</div>
                </div>
              </div>
            </div>

            {/* Request Budget */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-32 bg-pink-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
              <div className="flex items-center gap-2 text-lg font-bold text-slate-200 mb-6 relative z-10">
                <Activity className="text-pink-400" /> SLI & Event Budget Status
              </div>

              {reqBudgetObj && (
                <div className="space-y-6 relative z-10">
                  <div className="flex justify-between items-end border-b border-slate-800/50 pb-4">
                    <div>
                      <div className="text-sm text-slate-400 mb-1">Current SLI</div>
                      <div className={`text-4xl font-black font-mono flex items-center gap-3 ${reqBudgetObj.currentSli >= slo ? 'text-emerald-400' : 'text-red-400'}`}>
                        {reqBudgetObj.currentSli.toFixed(3)}%
                        {reqBudgetObj.currentSli >= slo ? <ShieldCheck size={28} /> : <AlertTriangle size={28} />}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-slate-400 mb-1">Target</div>
                      <div className="text-xl font-bold font-mono text-slate-200">{slo.toFixed(3)}%</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div className="bg-slate-950 rounded-xl p-4 border border-slate-800/50">
                      <div className="text-sm text-slate-400 mb-1">Allowed Failures</div>
                      <div className="text-2xl font-black text-slate-200 font-mono">{reqBudgetObj.allowedFailures.toLocaleString()}</div>
                    </div>
                    <div className={`rounded-xl p-4 border ${reqBudgetObj.isExhausted ? 'bg-red-900/20 border-red-500/30' : 'bg-slate-950 border-slate-800/50'}`}>
                      <div className={`text-sm mb-1 ${reqBudgetObj.isExhausted ? 'text-red-400' : 'text-slate-400'}`}>
                        {reqBudgetObj.isExhausted ? 'Budget Exceeded By' : 'Remaining Budget'}
                      </div>
                      <div className={`text-2xl font-black font-mono ${reqBudgetObj.isExhausted ? 'text-red-400' : 'text-emerald-400'}`}>
                        {Math.abs(reqBudgetObj.remainingBudget).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </motion.div>
        </div>
      </div>
    </div>
  );
}