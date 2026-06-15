import { Link, useLocation } from "react-router-dom";
import { MapPin, BarChart3, Info, Search, Shield, Route } from "lucide-react";
import { GlobalSearchBar } from "./GlobalSearchBar";

export const Navbar = () => {
  const { pathname } = useLocation();
  const links = [
    { to: "/", label: "Início", icon: MapPin },
    { to: "/buscar", label: "Buscar", icon: Search },
    { to: "/ranking", label: "Ranking", icon: BarChart3 },
    { to: "/sobre", label: "Sobre", icon: Info },
    { to: "/admin", label: "Admin", icon: Shield },
  ];
  return (
    <nav className="sticky top-0 z-50 border-b border-border/60 bg-background/75 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
        <Link to="/" className="group flex items-center gap-2.5">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-civic shadow-soft">
            <Route className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
            <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-secondary ring-2 ring-background" />
          </div>
          <div className="leading-none">
            <span className="block font-display text-lg font-bold tracking-tight">PavimentaBR</span>
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Ranking civic</span>
          </div>
        </Link>
        <div className="hidden flex-1 justify-center md:flex">
          <GlobalSearchBar />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto">
          {links.map(({ to, label, icon: Icon }) => {
            const active = pathname === to || (to !== "/" && pathname.startsWith(to));
            return (
              <Link key={to} to={to}
                className={`relative flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition-all ${
                  active
                    ? "bg-foreground text-background shadow-soft"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}>
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
