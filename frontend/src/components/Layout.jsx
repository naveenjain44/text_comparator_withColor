import { NavLink, Outlet, useLocation } from "react-router-dom";
import { GitCompare, Layers, BookText, HelpCircle, Terminal } from "lucide-react";

const tabs = [
  { to: "/compare", label: "Compare", icon: GitCompare, testid: "nav-compare" },
  { to: "/batch", label: "Batch", icon: Layers, testid: "nav-batch" },
  { to: "/glossary", label: "Glossary", icon: BookText, testid: "nav-glossary" },
  { to: "/guide", label: "Guide", icon: HelpCircle, testid: "nav-guide" },
];

export default function Layout() {
  const loc = useLocation();
  return (
    <div className="min-h-screen bg-[#0A0A0B] text-zinc-100">
      <header
        className="sticky top-0 z-50 border-b border-zinc-800 bg-[#0A0A0B]/95 backdrop-blur"
        data-testid="app-header"
      >
        <div className="px-8 py-4 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-white text-black flex items-center justify-center">
              <Terminal className="w-4 h-4" strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-[15px] font-semibold tracking-tight leading-none">
                SCT Text Comparator
              </div>
              <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-[0.16em] mt-1">
               mockup ↔ email
              </div>
            </div>
          </div>

          <nav className="flex items-center gap-1" data-testid="app-nav">
            {tabs.map(({ to, label, icon: Icon, testid }) => {
              const active = loc.pathname === to || (to === "/compare" && loc.pathname === "/");
              return (
                <NavLink
                  key={to}
                  to={to}
                  data-testid={testid}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 text-[13px] rounded-md transition-colors border ${
                    active
                      ? "bg-zinc-900 text-white border-zinc-800"
                      : "text-zinc-400 border-transparent hover:text-white hover:bg-zinc-900/60"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="uppercase tracking-wider text-[11px] font-mono">
                    {label}
                  </span>
                </NavLink>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="min-w-0" data-testid="main-content">
        <Outlet />
      </main>
    </div>
  );
}
