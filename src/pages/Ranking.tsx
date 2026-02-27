import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ArrowUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Navbar } from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";

interface RankingEntry {
  id: string;
  municipio_id: string;
  score: number;
  km_unpaved: number;
  km_paved_added: number;
  municipio_nome?: string;
  municipio_estado?: string;
}

const ESTADOS = [
  "Todos", "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO",
  "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ",
  "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
];

const Ranking = () => {
  const [entries, setEntries] = useState<RankingEntry[]>([]);
  const [search, setSearch] = useState("");
  const [estado, setEstado] = useState("Todos");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchRanking();
  }, []);

  const fetchRanking = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("ranking")
      .select("*, municipios(nome, estado)")
      .order("score", { ascending: false })
      .limit(500);

    if (!error && data) {
      setEntries(
        data.map((r: any) => ({
          id: r.id,
          municipio_id: r.municipio_id,
          score: r.score,
          km_unpaved: r.km_unpaved,
          km_paved_added: r.km_paved_added,
          municipio_nome: r.municipios?.nome,
          municipio_estado: r.municipios?.estado,
        }))
      );
    }
    setLoading(false);
  };

  const filtered = entries.filter((e) => {
    const matchSearch = !search || e.municipio_nome?.toLowerCase().includes(search.toLowerCase());
    const matchEstado = estado === "Todos" || e.municipio_estado === estado;
    return matchSearch && matchEstado;
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        <h1 className="mb-2 text-3xl font-bold text-foreground">Ranking Nacional</h1>
        <p className="mb-8 text-muted-foreground">
          Classificação dos municípios por desempenho em pavimentação
        </p>

        {/* Filters */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar município..."
              className="pl-10"
            />
          </div>
          <Select value={estado} onValueChange={setEstado}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              {ESTADOS.map((uf) => (
                <SelectItem key={uf} value={uf}>{uf}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <p className="text-muted-foreground">Carregando ranking...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20">
                <p className="text-lg font-medium text-foreground">Nenhum dado disponível</p>
                <p className="text-sm text-muted-foreground">
                  Pesquise municípios na página inicial para gerar dados do ranking.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">#</TableHead>
                    <TableHead>Município</TableHead>
                    <TableHead>UF</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead className="text-right">Km s/ pavimentação</TableHead>
                    <TableHead className="text-right">Km pavimentados</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((entry, i) => (
                    <TableRow
                      key={entry.id}
                      className="cursor-pointer"
                      onClick={() =>
                        entry.municipio_nome &&
                        navigate(`/municipio/${encodeURIComponent(entry.municipio_nome)}`)
                      }
                    >
                      <TableCell className="font-bold text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">{entry.municipio_nome}</TableCell>
                      <TableCell>{entry.municipio_estado}</TableCell>
                      <TableCell className="text-right font-bold text-primary">
                        {entry.score.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">{entry.km_unpaved.toFixed(1)}</TableCell>
                      <TableCell className="text-right text-primary">
                        {entry.km_paved_added.toFixed(1)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Ranking;
