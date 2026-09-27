import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { Finding } from '../core/types';
import { FindingCard } from './FindingCard';

export const SevAccordion = ({ title, findings, icon: Icon, color, bgClass }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  if (findings.length === 0) return null;
  return (
    <div className={`border ${bgClass} rounded-lg overflow-hidden mb-3 last:mb-0`}>
      <button onClick={() => setIsOpen(!isOpen)} className={`w-full flex items-center justify-between p-3 bg-slate-900/80 hover:bg-slate-800 transition-colors`}>
        <div className="flex items-center gap-2">
          <Icon size={16} className={color} />
          <span className={`font-bold text-sm ${color}`}>{title}</span>
          <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded-full font-bold text-slate-300 border border-slate-700/50">{findings.length}</span>
        </div>
        {isOpen ? <ChevronDown size={16} className={color} /> : <ChevronRight size={16} className={color} />}
      </button>
      {isOpen && (
        <div className="p-3 space-y-3 bg-slate-900/40 border-t border-slate-800/50">
          {findings.map((f: Finding) => <FindingCard key={f.id} finding={f} />)}
        </div>
      )}
    </div>
  );
};
