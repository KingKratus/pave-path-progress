import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import MunicipioDetail from "./pages/MunicipioDetail";
import Ranking from "./pages/Ranking";
import Sobre from "./pages/Sobre";
import Auth from "./pages/Auth";
import Admin from "./pages/Admin";
import Buscar from "./pages/Buscar";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/municipio/:nome" element={<MunicipioDetail />} />
          <Route path="/ranking" element={<Ranking />} />
          <Route path="/sobre" element={<Sobre />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/buscar" element={<Buscar />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
