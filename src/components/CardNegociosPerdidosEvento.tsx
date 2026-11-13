'use client';

import { numeroBR } from '@/components/base';

interface DadosPerdasEvento {
  total: number;
  porSdr: Array<{ nome: string; total: number }>;
  porMotivo: Array<{ motivo: string; total: number }>;
}

interface CardNegociosPerdidosEventoProps {
  dados: DadosPerdasEvento;
}

export function CardNegociosPerdidosEvento({ dados }: CardNegociosPerdidosEventoProps) {
  return (
    <section className="evento-distribuicao" aria-labelledby="evento-perdas-titulo">
      <div className="evento-distribuicao__cabecalho">
        <h3 id="evento-perdas-titulo">Hotéis perdidos</h3>
        <p>Negócios perdidos com a etiqueta Evento Porto Seguro · atribuição pelo proprietário</p>
      </div>

      <div className="evento-perdas__total">
        <strong className="numero grande" aria-label={`${dados.total} hotéis perdidos`}>
          {numeroBR(dados.total, 0)}
        </strong>
        <span>{dados.total === 1 ? 'hotel perdido' : 'hotéis perdidos'}</span>
      </div>

      <div className="evento-perdas__distribuicoes">
        <section aria-labelledby="evento-perdas-sdr-titulo">
          <h4 id="evento-perdas-sdr-titulo">Por SDR</h4>
          <div className="evento-matriz__rolagem" role="region" aria-label="Hotéis perdidos por SDR" tabIndex={0}>
            <table className="evento-matriz evento-perdas__tabela">
              <caption className="evento-matriz__legenda">Quantidade de hotéis perdidos por SDR proprietária do negócio.</caption>
              <thead>
                <tr>
                  <th className="evento-matriz__proprietario" scope="col">SDR</th>
                  <th className="evento-matriz__etapa" scope="col">Hotéis perdidos</th>
                </tr>
              </thead>
              <tbody>
                {dados.porSdr.map(({ nome, total }) => (
                  <tr key={nome}>
                    <th className="evento-matriz__proprietario" scope="row">{nome}</th>
                    <td className="evento-matriz__valor">{numeroBR(total, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="evento-perdas-motivo-titulo">
          <h4 id="evento-perdas-motivo-titulo">Por motivo</h4>
          <div className="evento-matriz__rolagem" role="region" aria-label="Hotéis perdidos por motivo" tabIndex={0}>
            <table className="evento-matriz evento-perdas__tabela">
              <caption className="evento-matriz__legenda">Quantidade de hotéis perdidos por motivo informado no Pipedrive.</caption>
              <thead>
                <tr>
                  <th className="evento-matriz__proprietario" scope="col">Motivo</th>
                  <th className="evento-matriz__etapa" scope="col">Hotéis perdidos</th>
                </tr>
              </thead>
              <tbody>
                {dados.total > 0 ? (
                  dados.porMotivo.map(({ motivo, total }) => (
                    <tr key={motivo}>
                      <th className="evento-matriz__proprietario" scope="row">{motivo}</th>
                      <td className="evento-matriz__valor">{numeroBR(total, 0)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="evento-vazio" colSpan={2}>Nenhum hotel perdido com esta etiqueta.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  );
}
