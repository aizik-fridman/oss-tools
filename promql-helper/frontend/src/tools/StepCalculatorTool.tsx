import { useState, useMemo } from 'react';

export default function StepCalculatorTool() {
  const [rangeHours, setRangeHours] = useState(24);
  const [widthPx, setWidthPx] = useState(1000);
  const [minStepSecs, setMinStepSecs] = useState(15);

  const stats = useMemo(() => {
    const rangeSecs = rangeHours * 3600;
    // Calculate theoretical step to match exactly 1 point per pixel
    let step = Math.floor(rangeSecs / widthPx);
    
    // Ensure step is not less than the minimum scrape interval
    if (step < minStepSecs) step = minStepSecs;
    
    // Total points that will be returned
    const points = Math.floor(rangeSecs / step);
    
    // Humanize step
    let humanStep = `${step}s`;
    if (step >= 3600 && step % 3600 === 0) humanStep = `${step/3600}h`;
    else if (step >= 60 && step % 60 === 0) humanStep = `${step/60}m`;
    
    // Recommend matrix selector range (usually 3-4x the step for rate())
    const matrixRate = step * 4;
    let humanMatrix = `${matrixRate}s`;
    if (matrixRate >= 3600 && matrixRate % 3600 === 0) humanMatrix = `${matrixRate/3600}h`;
    else if (matrixRate >= 60 && matrixRate % 60 === 0) humanMatrix = `${matrixRate/60}m`;

    return { step, humanStep, points, humanMatrix };
  }, [rangeHours, widthPx, minStepSecs]);

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-[#0f172a]">
      <div className="max-w-3xl mx-auto space-y-8">
        <header>
          <h2 className="text-2xl font-bold text-violet-400">Step & Resolution Calculator</h2>
          <p className="text-slate-400 mt-2">Calculate the optimal PromQL <code className="bg-slate-800 px-1 py-0.5 rounded">step</code> value based on your dashboard width.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Time Range (Hours)</label>
              <input 
                type="number" value={rangeHours} onChange={e => setRangeHours(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200"
              />
              <p className="text-xs text-slate-500 mt-1">Total time covered by the query panel.</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Panel Width (Pixels)</label>
              <input 
                type="number" value={widthPx} onChange={e => setWidthPx(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200"
              />
              <p className="text-xs text-slate-500 mt-1">Available horizontal pixels for the chart.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Min Scrape Interval (Secs)</label>
              <input 
                type="number" value={minStepSecs} onChange={e => setMinStepSecs(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200"
              />
              <p className="text-xs text-slate-500 mt-1">Your Prometheus global scrape interval (e.g. 15s).</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-violet-900/20 border border-violet-800/50 rounded-xl p-6 flex flex-col items-center justify-center text-center">
              <div className="text-slate-400 text-sm mb-2">Optimal Step Size</div>
              <div className="text-5xl font-bold text-violet-400 font-mono">{stats.humanStep}</div>
              <div className="text-slate-500 text-xs mt-2">({stats.step} seconds)</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-slate-400 text-sm">Data Points Returned:</span>
                <span className="text-slate-200 font-bold">{stats.points}</span>
              </div>
              <div className="flex justify-between items-center mb-4">
                <span className="text-slate-400 text-sm">Suggested rate() interval:</span>
                <span className="text-slate-200 font-bold bg-slate-800 px-2 py-1 rounded">[{stats.humanMatrix}]</span>
              </div>
              
              <div className="text-xs text-slate-500 mt-4 p-3 bg-slate-800/50 rounded-lg">
                <strong>Tip:</strong> In Grafana, this is calculated automatically via the <code className="text-sky-400">$__interval</code> and <code className="text-sky-400">$__rate_interval</code> variables.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
