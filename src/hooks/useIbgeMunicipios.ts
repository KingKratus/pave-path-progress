import { useQuery } from "@tanstack/react-query";

export interface IbgeMunicipio {
  id: number;
  nome: string;
  uf: string;
}

async function fetchAll(): Promise<IbgeMunicipio[]> {
  const res = await fetch("https://servicodados.ibge.gov.br/api/v1/localidades/municipios");
  if (!res.ok) throw new Error("ibge fetch failed");
  const data = await res.json();
  return data.map((m: any) => ({
    id: m.id,
    nome: m.nome,
    uf: m["microrregiao"]?.mesorregiao?.UF?.sigla
      ?? m.regiao_imediata?.regiao_intermediaria?.UF?.sigla
      ?? "",
  }));
}

export function useIbgeMunicipios() {
  return useQuery({
    queryKey: ["ibge-municipios"],
    queryFn: fetchAll,
    staleTime: 1000 * 60 * 60 * 24,
    gcTime: 1000 * 60 * 60 * 24,
  });
}

export function searchMunicipios(list: IbgeMunicipio[], term: string, limit = 8): IbgeMunicipio[] {
  const t = term.trim().toLowerCase();
  if (t.length < 2) return [];
  const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const target = norm(t);
  const results: IbgeMunicipio[] = [];
  for (const m of list) {
    if (norm(m.nome).includes(target)) {
      results.push(m);
      if (results.length >= limit) break;
    }
  }
  return results;
}
