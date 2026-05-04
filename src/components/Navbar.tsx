import { Link, useLocation } from "react-router-dom";
import { MapPin, BarChart3, Info, Search, Shield } from "lucide-react";

export const Navbar = () => {
  const location = useLocation();
  const links = [
    { to: "/", label: "Início", icon: MapPin },
    { to: "/buscar", label: "Buscar", icon: Search },
    { to: "/ranking", label: "Ranking", icon: BarChart3 },
    { to: "/sobre", label: "Sobre", icon: Info },
    { to: "/admin", label: "Admin", icon: Shield },
  ];
  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-card/85 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-md">
            <MapPin className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight text-foreground">PavimentaBR</span>
        </Link>
        <div className="flex items-center gap-1 overflow-x-auto">
          {links.map((link) => {
            const isActive = location.pathname === link.to;
            return (
              <Link key={link.to} to={link.to}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}>
                <link.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{link.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
