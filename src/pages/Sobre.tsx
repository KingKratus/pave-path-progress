import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const Sobre = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto max-w-3xl px-4 py-12">
        <h1 className="mb-8 text-3xl font-bold text-foreground">Sobre o Projeto</h1>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>O que é o PavimentaBR?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground">
              <p>
                O PavimentaBR é uma plataforma pública que utiliza dados do OpenStreetMap para
                identificar e mapear ruas não pavimentadas em municípios brasileiros.
              </p>
              <p>
                Nosso objetivo é dar visibilidade à situação da infraestrutura viária
                e permitir que cidadãos acompanhem a evolução da pavimentação em suas cidades.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fonte dos dados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground">
              <p>
                Os dados são obtidos via <strong className="text-foreground">Overpass API</strong>, que
                consulta a base do OpenStreetMap. Buscamos vias com atributo{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-sm text-foreground">surface</code>{" "}
                classificado como: unpaved, dirt, gravel, ground, earth ou compacted.
              </p>
              <p>
                A distância de cada via é calculada usando a fórmula de Haversine a
                partir das coordenadas dos nós da via.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Metodologia do ranking</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground">
              <p>O score de cada município é calculado pela fórmula:</p>
              <div className="rounded-lg bg-muted p-4">
                <code className="text-sm text-foreground">
                  Score = (0.5 × normalizado(km_pavimentados)) + (0.3 × eficiência) - (0.2 × normalizado(km_sem_pavimentação))
                </code>
              </div>
              <ul className="list-inside list-disc space-y-1">
                <li><strong className="text-foreground">km_pavimentados:</strong> quilômetros pavimentados no período analisado</li>
                <li><strong className="text-foreground">eficiência:</strong> relação entre investimento e resultado</li>
                <li><strong className="text-foreground">km_sem_pavimentação:</strong> total atual de ruas sem pavimentação</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Limitações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground">
              <p>
                Os dados do OpenStreetMap são colaborativos e podem não estar completos
                para todos os municípios. A ausência de dados não significa ausência de
                vias não pavimentadas.
              </p>
              <p>
                A comparação temporal depende da frequência de atualização dos dados
                no OpenStreetMap para cada região.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Sobre;
