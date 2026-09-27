import type { Finding } from '../core/types';
import { AlertCircle, AlertTriangle, InfoIcon, CheckCircle } from 'lucide-react';

export const FindingCard = ({ finding }: { finding: Finding }) => {
  const isCritical = finding.severity === 'critical';
  const isWarning = finding.severity === 'warning';
  const isInfo = finding.severity === 'info';
  const isSuccess = finding.severity === 'success';
  
  const bgClass = isCritical ? 'bg-red-950/30 border-red-900/50' : 
                  isWarning ? 'bg-amber-950/30 border-amber-900/50' : 
                  isInfo ? 'bg-sky-950/30 border-sky-900/50' : 
                  'bg-emerald-950/30 border-emerald-900/50';

  const textClass = isCritical ? 'text-red-400' : 
                    isWarning ? 'text-amber-400' : 
                    isInfo ? 'text-sky-400' : 
                    'text-emerald-400';
  
  const IconComponent = isCritical ? AlertCircle : isWarning ? AlertTriangle : isInfo ? InfoIcon : CheckCircle;

  return (
    <div className={`p-4 border ${bgClass} rounded-lg mb-3 last:mb-0`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <IconComponent size={16} className={textClass} />
          <h4 className={`font-bold text-sm ${textClass}`}>
            {isSuccess ? finding.title : `[${finding.severity.toUpperCase()}] ${finding.title}`}
          </h4>
        </div>
        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
          finding.confidence === 'high' ? 'bg-purple-900/30 border-purple-500/30 text-purple-300' : 
          finding.confidence === 'medium' ? 'bg-blue-900/30 border-blue-500/30 text-blue-300' : 
          'bg-slate-800 border-slate-700 text-slate-400'
        }`}>
          {finding.confidence} Confidence
        </span>
      </div>
      
      {(finding.panel || finding.variable) && (
        <div className="text-xs text-slate-400 mb-2 font-mono bg-slate-900/50 px-2 py-1 rounded inline-block">
          {finding.panel ? `Panel: ${finding.panel}` : `Variable: ${finding.variable}`}
        </div>
      )}
      
      <p className={`text-sm ${isSuccess ? 'text-slate-400' : 'text-slate-300'} mb-1`}>{finding.description}</p>
      {finding.recommendation && (
        <p className="text-sm text-emerald-400/90 italic">{finding.recommendation}</p>
      )}
    </div>
  );
};
