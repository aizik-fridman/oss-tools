import { Link, Outlet, useLocation } from 'react-router-dom';
import { Search, LayoutDashboard, FileWarning, Menu, X, Info } from 'lucide-react';
import { useState } from 'react';

export default function PortalLayout() {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  const navItems = [
    { path: '/dashboard-analyzer', name: 'Dashboard Analyzer', icon: LayoutDashboard },
    { path: '/promql-helper', name: 'PromQL Helper', icon: Search },
    { path: '/alert-analyzer', name: 'Alert Analyzer', icon: FileWarning },
  ];

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#0f172a] text-slate-200 font-sans overflow-hidden">
      
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between h-16 px-4 bg-slate-900 border-b border-slate-800 shrink-0 z-40 relative">
        <Link to="/" className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-emerald-400">
          Observability Helpers
        </Link>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-slate-400 hover:text-slate-200 p-2">
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar */}
      <div className={`
        ${isMobileMenuOpen ? 'flex' : 'hidden'} 
        md:flex w-full md:w-64 bg-slate-900 md:border-r border-slate-800 flex-col shrink-0
        absolute md:static top-16 bottom-0 z-50 md:z-0
      `}>
        <div className="hidden md:flex h-16 items-center px-6 border-b border-slate-800 shrink-0">
          <Link to="/" className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-emerald-400">
            Observability Helpers
          </Link>
        </div>
        
        <nav className="flex-1 py-6 px-3 space-y-2 overflow-y-auto">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
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
        
        <div className="p-4 border-t border-slate-800 text-xs text-slate-500 text-center flex flex-col gap-1 shrink-0 bg-slate-900 pb-safe">
          <span>OSS Tools Portal v1.0</span>
          <button onClick={() => setIsAboutOpen(true)} className="text-[11px] text-slate-600 hover:text-sky-400 transition-colors font-medium">
            About this site
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden relative flex flex-col z-0">
        <Outlet />
      </div>

      {isAboutOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-sm w-full shadow-2xl overflow-hidden relative">
            <button onClick={() => setIsAboutOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
              <X size={20} />
            </button>
            <div className="p-6">
              <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2 mb-4">
                <Info className="text-sky-400" /> About This Site
              </h3>
              
              <div className="space-y-4 text-sm text-slate-300 leading-relaxed">
                <p>
                  <strong>Creator:</strong> Aizik Friedman, Observability Engineer and SRE enthusiast.
                  <br/>
                  <a href="https://me.aizikfriedman.com" target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">Visit My Website</a>
                </p>
                
                <div className="h-px bg-slate-800 w-full" />
                
                <p className="text-xs text-slate-400">
                  <strong className="text-slate-300">Privacy & Limits:</strong> 100% of the analysis runs locally in your browser. No data, YAMLs, or queries are sent to any external server. 
                </p>
                
                <div className="h-px bg-slate-800 w-full" />
                
                <p className="text-xs text-slate-400">
                  <strong className="text-slate-300">Disclaimer:</strong> This site was created with the assistance of AI for personal purposes. 
                  If you found it helpful or encountered a bug, please report it here:
                  <br/>
                  <a href="https://github.com/aizik-fridman/oss-tools/issues" target="_blank" rel="noreferrer" className="text-sky-400 hover:underline mt-1 inline-block">
                    github.com/aizik-fridman/oss-tools/issues
                  </a>
                </p>
                
                <div className="h-px bg-slate-800 w-full" />
                
                <p>
                  <strong>Contact:</strong>
                  <br/>
                  <a href="mailto:me@aizikfriedman.com" className="text-sky-400 hover:underline">Visit My Website</a>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
