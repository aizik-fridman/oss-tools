import { Link, Outlet, useLocation } from 'react-router-dom';
import { Activity, Search, LayoutDashboard, Clock, FileWarning, RefreshCw } from 'lucide-react';

export default function PortalLayout() {
  const location = useLocation();

  const navItems = [
    { path: '/explainer', name: 'Parser & Explainer', icon: Search },
    { path: '/selector-builder', name: 'Selector Builder', icon: Activity },
    { path: '/alert-analyzer', name: 'Alert Analyzer', icon: FileWarning },
    { path: '/dashboard-analyzer', name: 'Dashboard Analyzer', icon: LayoutDashboard },
    { path: '/step-calculator', name: 'Step Calculator', icon: Clock },
    { path: '/yaml-converter', name: 'YAML Converter', icon: RefreshCw },
  ];

  return (
    <div className="flex h-screen bg-[#0f172a] text-slate-200 font-sans overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-slate-800">
          <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-emerald-400">
            PromQL Tools
          </h1>
        </div>
        
        <nav className="flex-1 py-6 px-3 space-y-2 overflow-y-auto">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors font-medium ${
                  isActive 
                    ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent'
                }`}
              >
                <Icon size={20} />
                {item.name}
              </Link>
            )
          })}
        </nav>
        
        <div className="p-4 border-t border-slate-800 text-xs text-slate-500 text-center">
          OSS Tools Portal v1.0
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative flex flex-col">
        <Outlet />
      </div>
    </div>
  );
}
