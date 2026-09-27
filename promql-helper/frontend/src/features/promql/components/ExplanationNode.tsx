import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type NodeInfo = {
  type: string;
  expr: string;
  explanation: string;
  children?: NodeInfo[];
};

export const ExplanationNode = ({ node, isRoot = false }: { node: NodeInfo, isRoot?: boolean }) => {
  const [expanded, setExpanded] = useState(isRoot);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className={`mt-3 ${!isRoot ? 'ml-2' : ''}`}>
      <motion.div 
        layout
        className={`bg-slate-800/80 border ${expanded ? 'border-sky-500/50' : 'border-slate-700'} p-4 rounded-xl transition-colors ${hasChildren ? 'cursor-pointer hover:border-sky-500/30 shadow-sm' : 'shadow-sm'}`}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="font-bold text-sky-400 flex items-center gap-2">
            {hasChildren && (
              <span className="text-slate-500 text-[10px] bg-slate-900 w-5 h-5 flex items-center justify-center rounded-full">
                {expanded ? '▼' : '▶'}
              </span>
            )}
            {node.type}
          </div>
        </div>
        <div className="text-slate-300 text-sm mt-2">{node.explanation}</div>
        {node.expr && node.expr !== 'unknown' && (
          <div className="text-slate-400 font-mono text-xs mt-3 bg-slate-900/50 p-2 rounded-lg break-all border border-slate-800">
            {node.expr}
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {hasChildren && expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            className="overflow-hidden relative pl-6"
          >
            <div className="absolute left-[22px] top-0 bottom-6 w-px bg-slate-700" />
            <div className="flex flex-col relative z-10">
              {node.children!.map((child, i) => (
                <div key={i} className="relative">
                  <div className="absolute -left-6 top-8 w-6 h-px bg-slate-700" />
                  <ExplanationNode node={child} />
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
