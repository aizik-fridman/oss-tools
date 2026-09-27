import { ChevronDown, ChevronRight, AlertCircle, AlertTriangle, InfoIcon, CheckCircle } from 'lucide-react';
import { SevAccordion } from './SevAccordion';

export const CategorySection = ({ title, icon: Icon, catKey, color, analysis, expandedCats, toggleCat }: any) => {
  const isExpanded = expandedCats[catKey];
  const catFindings = analysis?.findings.filter((f: any) => f.category === catKey) || [];
  const issuesCount = catFindings.filter((f: any) => f.severity !== 'success').length;
  const hasIssues = issuesCount > 0;

  const criticals = catFindings.filter((f: any) => f.severity === 'critical');
  const warnings = catFindings.filter((f: any) => f.severity === 'warning');
  const infos = catFindings.filter((f: any) => f.severity === 'info');
  const successes = catFindings.filter((f: any) => f.severity === 'success');
  
  return (
    <div className={`bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden`}>
      <button 
        onClick={() => toggleCat(catKey)}
        className={`w-full flex items-center justify-between p-4 bg-slate-800/30 hover:bg-slate-800/60 transition-colors border-b border-slate-800`}
      >
        <div className="flex items-center gap-3">
          <Icon className={color} size={20} />
          <span className="font-bold text-slate-200">{title}</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${hasIssues ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
            {hasIssues ? `${issuesCount} Issues` : 'All Clean'}
          </span>
        </div>
        {isExpanded ? <ChevronDown size={20} className="text-slate-500" /> : <ChevronRight size={20} className="text-slate-500" />}
      </button>
      {isExpanded && (
        <div className="p-4 bg-slate-900/20">
          {catFindings.length > 0 ? (
            <div>
              <SevAccordion title="Critical Issues" findings={criticals} icon={AlertCircle} color="text-red-400" bgClass="border-red-900/30" />
              <SevAccordion title="Warnings" findings={warnings} icon={AlertTriangle} color="text-amber-400" bgClass="border-amber-900/30" />
              <SevAccordion title="Info & Suggestions" findings={infos} icon={InfoIcon} color="text-sky-400" bgClass="border-sky-900/30" />
              <SevAccordion title="Passed Checks" findings={successes} icon={CheckCircle} color="text-emerald-400" bgClass="border-emerald-900/30" />
            </div>
          ) : (
            <div className="flex items-center gap-2 text-emerald-400 text-sm">
              <CheckCircle size={16} /> No findings in this category.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
