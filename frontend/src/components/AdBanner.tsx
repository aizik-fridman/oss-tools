import { useEffect, useRef } from 'react';

export default function AdBanner() {
  const containerRef = useRef<HTMLDivElement>(null);
  const scriptInjected = useRef(false);

  useEffect(() => {
    if (!scriptInjected.current && containerRef.current) {
      scriptInjected.current = true;
      const script = document.createElement('script');
      script.src = "https://pl31541424.profitableratecpmnetwork.com/b6b3a460d18fc1959cd96005a37609cc/invoke.js";
      script.async = true;
      script.setAttribute('data-cfasync', 'false');
      containerRef.current.appendChild(script);
    }
  }, []);

  return (
    <div className="w-full flex justify-center py-4 bg-slate-900 border-t border-slate-800 shrink-0 z-50">
      <div id="container-b6b3a460d18fc1959cd96005a37609cc" ref={containerRef}></div>
    </div>
  );
}