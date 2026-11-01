import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { backendConfigured } from '../lib/supabase';
import { useAuth } from '../state/auth';
import { Avatar, ScoopIcon, Scoops } from './kit';

const NAV: { to: string; label: string; icon: ReactNode }[] = [
  { to: '/', label: 'Home', icon: <path d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /> },
  { to: '/battle', label: 'Battle', icon: <path d="M4 20 15 9m-3-5 8 8-3 3-8-8zM6 14l4 4-2 2-4-4z" /> },
  { to: '/collection', label: 'Collection', icon: <path d="M4 5h10v14H4zM17 7l3 1-3 12-3-1" /> },
  { to: '/decks', label: 'Decks', icon: <path d="M6 3h12v18H6zM9 7h6M9 11h6M9 15h3" /> },
  { to: '/shop', label: 'Shop', icon: <path d="M4 8h16l-1 12H5zM8 8V6a4 4 0 0 1 8 0v2" /> },
  { to: '/profile', label: 'Profile', icon: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9a8 8 0 0 1 16 0" /> },
];

function NavIcon({ children }: { children: ReactNode }) {
  return <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}

export function Logo({ small = false }: { small?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <ScoopIcon size={small ? 26 : 34} />
      <span className="leading-none">
        <span className={`block font-display font-extrabold tracking-tight text-cone-50 ${small ? 'text-lg' : 'text-2xl'}`}>Helado<span className="text-berry-400">TCG</span></span>
        {!small && <span className="block text-[10px] font-bold uppercase tracking-[.25em] text-white/50">Fakemon Card Game</span>}
      </span>
    </span>
  );
}

export function Layout() {
  const { summary } = useAuth();
  const loc = useLocation();
  const immersive = loc.pathname.startsWith('/match') || loc.pathname.startsWith('/practice/play');
  if (immersive) return <Outlet />;
  return (
    <div className="flex min-h-full">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-1 border-r border-white/5 bg-black/20 p-4 md:flex">
        <div className="mb-6 px-2 pt-2"><Logo /></div>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => `flex items-center gap-3 rounded-2xl px-3 py-2.5 font-display text-lg font-bold transition ${isActive ? 'bg-berry-400 text-[#2a1710] shadow-[0_4px_0_#b0236c]' : 'text-white/75 hover:bg-white/10'}`}>
            <NavIcon>{n.icon}</NavIcon>{n.label}
          </NavLink>
        ))}
        <div className="mt-auto checker rounded-2xl p-3 text-xs text-white/50">Helado Region · v0.1</div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/5 bg-[#2a1710]/80 px-4 py-3 backdrop-blur md:px-8">
          <div className="md:hidden"><Logo small /></div>
          <div className="ml-auto flex items-center gap-3">
            {!backendConfigured && <span className="chip bg-amber-400/20 text-amber-200">Offline · Practice only</span>}
            {summary && <span className="rounded-full bg-black/30 px-3 py-1.5"><Scoops n={summary.scoops} /></span>}
            {summary && <NavLink to="/profile" className="flex items-center gap-2"><Avatar name={summary.profile.avatar} size={34} /><span className="hidden font-bold sm:inline">{summary.profile.username}</span></NavLink>}
          </div>
        </header>
        <motion.main key={loc.pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 md:px-8 md:pb-10">
          <Outlet />
        </motion.main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-white/10 bg-[#24140d]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2 text-[10px] font-bold ${isActive ? 'text-berry-400' : 'text-white/60'}`}>
            <NavIcon>{n.icon}</NavIcon>{n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
