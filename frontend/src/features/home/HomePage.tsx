import { Link } from 'react-router-dom';
import { Search, LayoutDashboard, FileWarning, Calculator, ArrowRight } from 'lucide-react';

export default function HomePage() {
  const tools = [
    { 
      path: '/dashboard-analyzer', 
      name: 'Dashboard Analyzer', 
      icon: LayoutDashboard,
      description: 'Static analysis for Grafana Dashboards based on SRE methodologies.',
      color: 'text-pink-400',
      bgClass: 'bg-pink-400/10 hover:bg-pink-400/20',
      borderClass: 'border-pink-500/20'
    },
    { 
      path: '/promql-helper', 
      name: 'PromQL Helper', 
      icon: Search,
      description: 'Explain, format, and visualize PromQL queries safely in the browser.',
      color: 'text-sky-400',
      bgClass: 'bg-sky-400/10 hover:bg-sky-400/20',
      borderClass: 'border-sky-500/20'
    },
    { 
      path: '/alert-analyzer', 
      name: 'Alert Analyzer', 
      icon: FileWarning,
      description: 'Validate and lint Prometheus alerting rules and Grafana Unified Alerting files.',
      color: 'text-amber-400',
      bgClass: 'bg-amber-400/10 hover:bg-amber-400/20',
      borderClass: 'border-amber-500/20'
    },
    { 
      path: '/sre-calculator', 
      name: 'SRE Calculators', 
      icon: Calculator,
      description: 'Calculate SLOs, Error Budgets, and SLIs based on Site Reliability Engineering principles.',
      color: 'text-violet-400',
      bgClass: 'bg-violet-400/10 hover:bg-violet-400/20',
      borderClass: 'border-violet-500/20'
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-[#0f172a] flex items-center justify-center min-h-screen">
      <div className="max-w-4xl w-full">
        <header className="text-center mb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-emerald-400 mb-4">
            Observability Helpers
          </h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            A suite of 100% client-side, WebAssembly-powered tools to build, analyze, and optimize your monitoring stack.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {tools.map((tool, idx) => {
            const Icon = tool.icon;
            return (
              <Link
                key={tool.path}
                to={tool.path}
                className={`group flex flex-col p-6 rounded-2xl border ${tool.borderClass} ${tool.bgClass} transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-black/50 animate-in fade-in slide-in-from-bottom-4`}
                style={{ animationDelay: `${idx * 150}ms`, animationFillMode: 'both' }}
              >
                <div className={`${tool.color} mb-4`}>
                  <Icon size={40} strokeWidth={1.5} />
                </div>
                <h2 className={`text-xl font-bold text-slate-200 mb-2 group-hover:${tool.color} transition-colors`}>
                  {tool.name}
                </h2>
                <p className="text-slate-400 text-sm flex-1 leading-relaxed">
                  {tool.description}
                </p>
                <div className={`mt-6 flex items-center gap-2 text-sm font-bold ${tool.color} opacity-0 group-hover:opacity-100 transition-opacity -translate-x-4 group-hover:translate-x-0 transform duration-300`}>
                  Open Tool <ArrowRight size={16} />
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  );
}
