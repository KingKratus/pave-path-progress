import { Navbar } from "@/components/Navbar";
import { Database, Calculator, AlertTriangle, Github } from "lucide-react";

const Sobre = () => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <div className="container mx-auto max-w-5xl px-4 py-12">
      <div className="mb-10 max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">Sobre</p>
        <h1 className="mt-2 font-display text-4xl font-bold tracking-tight md:text-5xl">
          Transparência viária, dados abertos.
        </h1>
        <p className="mt-3 text-muted-foreground">
          PavimentaBR cruza dados do OpenStreetMap para mapear ruas não pavimentadas em todo o Brasil.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-6 md:auto-rows-[180px]">
        <div className="bento col-span-6 md:col-span-4 md:row-span-2 p-7">
          <Database className="mb-4 h-7 w-7 text-primary" />
          <h2 className="font-display text-2xl font-semibold">Fonte dos dados</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Coletamos via Overpass API filtrando vias com <code className="rounded bg-muted px-1.5 py-0.5 text-xs">surface</code> em
            <strong className="text-foreground"> unpaved, dirt, gravel, ground, earth, compacted, sand, mud</strong>.
            Distâncias calculadas por Haversine sobre os nós da geometria.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
            {["unpaved","dirt","gravel","ground","earth","compacted","sand","mud"].map(s => (
              <span key={s} className="rounded-lg border border-border bg-muted/50 px-3 py-2 font-mono">{s}</span>
            ))}
          </div>
        </div>

        <div className="bento col-span-6 md:col-span-2 p-6 bg-gradient-civic text-primary-foreground">
          <Calculator className="mb-3 h-6 w-6" />
          <h3 className="font-display text-lg font-semibold">Score</h3>
          <p className="mt-1 text-xs text-primary-foreground/80">
            0.5·norm(km_pavimentados) + 0.3·eficiência − 0.2·norm(km_sem_pav.)
          </p>
        </div>

        <div className="bento col-span-6 md:col-span-2 p-6">
          <AlertTriangle className="mb-3 h-6 w-6 text-secondary" />
          <h3 className="font-display text-lg font-semibold">Limitações</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            OSM é colaborativo. Ausência de dado ≠ ausência de via.
          </p>
        </div>

        <a href="https://www.openstreetmap.org" target="_blank" rel="noreferrer"
           className="bento col-span-6 md:col-span-3 p-6 group">
          <Github className="mb-3 h-6 w-6" />
          <h3 className="font-display text-lg font-semibold">Aberto e colaborativo</h3>
          <p className="mt-1 text-xs text-muted-foreground">Contribua editando o OSM da sua cidade. Próxima sync horária reflete suas edições.</p>
        </a>

        <div className="bento col-span-6 md:col-span-3 p-6">
          <h3 className="font-display text-lg font-semibold">Atualização</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Sincronização automática horária. Snapshots mensais para comparação temporal.
          </p>
        </div>
      </div>
    </div>
  </div>
);

export default Sobre;
