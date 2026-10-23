import { NavLink, Outlet } from "react-router-dom";
import { Activity } from "lucide-react";

export function AppShell() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col font-sans">
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <NavLink
              to="/"
              className="flex items-center gap-2.5 text-slate-900 hover:text-blue-600 transition-colors"
            >
              <Activity className="w-5 h-5 text-blue-600" />
              <span className="font-[650] text-base tracking-[-0.01em]">
                Wind Decision Console
              </span>
            </NavLink>
            <nav className="flex items-center gap-1">
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    isActive
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`
                }
              >
                Decision
              </NavLink>
              <NavLink
                to="/accuracy"
                className={({ isActive }) =>
                  `px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    isActive
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`
                }
              >
                Accuracy
              </NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Elexon data
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 text-xs text-slate-400 text-center">
        Wind Decision Console · EPEX SPOT GB DAA 1 (60&apos;) · 09:20 Europe/London Cutoff
      </footer>
    </div>
  );
}
