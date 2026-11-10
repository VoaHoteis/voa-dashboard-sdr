'use client';

import { Painel, numeroBR, useApi } from '@/components/base';
import { FUNNEL_LABEL } from '@/lib/config';
import type { MetricasEventoPortoSeguroResposta } from '@/lib/types';

const numeroInteiroBR = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

export function CardEventoPortoSeguro() {
  const estado = useApi<MetricasEventoPortoSeguroResposta>('/api/evento-porto-seguro');

  return (
    <Painel titulo="Evento Porto Seguro" estado={estado}>
      {(dados) => {
        const funis = [...new Set(dados.negociosPorEtapa.map((item) => item.funil))];
        const etapasPorFunil = funis.map((funil) => ({
          funil,
          etapas: dados.negociosPorEtapa
            .filter((item) => item.funil === funil)
            .sort((a, b) => a.ordem - b.ordem),
        }));
        const matriz = new Map(
          dados.negociosPorProprietarioEtapa.map((item) => [
            JSON.stringify([item.proprietario, item.funil, item.etapaId]),
            item.total,
          ])
        );
        const totalEtapa = (funil: string, etapaId: number) =>
          dados.negociosPorProprietarioEtapa
            .filter((item) => item.funil === funil && item.etapaId === etapaId)
            .reduce((total, item) => total + item.total, 0);
        const foraDasEtapas = (proprietario: string, total: number) => {
          const distribuido = dados.negociosPorProprietarioEtapa
            .filter((item) => item.proprietario === proprietario)
            .reduce((soma, item) => soma + item.total, 0);
          return Math.max(0, total - distribuido);
        };
        const totalForaDasEtapas = dados.negociosPorProprietario.reduce(
          (total, item) => total + foraDasEtapas(item.nome, item.total),
          0
        );

        return (
          <div className="evento-conteudo" aria-label="Métricas da etiqueta Evento Porto Seguro">
            <div className="evento-metricas">
              <div className="evento-metrica">
                <strong className="numero grande" aria-label={`${numeroInteiroBR.format(dados.leads)} leads`}>
                  {numeroBR(dados.leads, 0)}
                </strong>
                <span>Leads com a etiqueta</span>
              </div>
              <div className="evento-metrica">
                <strong
                  className="numero grande"
                  aria-label={`${numeroInteiroBR.format(dados.negociosAbertos)} negócios abertos`}
                >
                  {numeroBR(dados.negociosAbertos, 0)}
                </strong>
                <span>Negócios em aberto com a etiqueta</span>
              </div>
            </div>

            <section className="evento-distribuicao" aria-labelledby="evento-distribuicao-titulo">
              <div className="evento-distribuicao__cabecalho">
                <h3 id="evento-distribuicao-titulo">
                  Negócios por proprietário e etapa do funil
                </h3>
                <p>
                  Cada linha mostra o total da pessoa e onde os negócios estão nas etapas exibidas.
                </p>
              </div>

              {dados.negociosPorProprietario.length > 0 ? (
                <div
                  className="evento-matriz__rolagem"
                  role="region"
                  aria-label="Distribuição de negócios por proprietário e etapa do funil. Role horizontalmente para ver todas as etapas."
                  tabIndex={0}
                >
                  <table className="evento-matriz">
                    <caption className="evento-matriz__legenda">
                      Contagens por proprietário. O total inclui negócios sem etapa correspondente
                      nos funis exibidos, apresentados na última coluna.
                    </caption>
                    <thead>
                      <tr>
                        <th className="evento-matriz__fixa evento-matriz__proprietario" scope="col" rowSpan={2}>
                          Proprietário
                        </th>
                        <th className="evento-matriz__fixa evento-matriz__total" scope="col" rowSpan={2}>
                          Total
                        </th>
                        {etapasPorFunil.map(({ funil, etapas }) => (
                          <th
                            className="evento-matriz__grupo"
                            data-funil={funil === FUNNEL_LABEL.novosNegocios ? 'novos' : 'salabim'}
                            colSpan={etapas.length}
                            key={funil}
                            scope="colgroup"
                          >
                            {funil}
                          </th>
                        ))}
                        <th className="evento-matriz__fora" scope="col" rowSpan={2}>
                          Fora das etapas
                        </th>
                      </tr>
                      <tr>
                        {etapasPorFunil.flatMap(({ funil, etapas }) =>
                          etapas.map((etapa) => (
                            <th
                              className="evento-matriz__etapa"
                              key={`${funil}-${etapa.etapaId}`}
                              scope="col"
                            >
                              {etapa.etapa}
                            </th>
                          ))
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {dados.negociosPorProprietario.map((proprietario) => (
                        <tr key={proprietario.nome}>
                          <th className="evento-matriz__fixa evento-matriz__proprietario" scope="row">
                            {proprietario.nome}
                          </th>
                          <td className="evento-matriz__fixa evento-matriz__total">
                            {numeroBR(proprietario.total, 0)}
                          </td>
                          {etapasPorFunil.flatMap(({ funil, etapas }) =>
                            etapas.map((etapa) => (
                              <td
                                className="evento-matriz__valor"
                                data-funil={funil === FUNNEL_LABEL.novosNegocios ? 'novos' : 'salabim'}
                                key={`${funil}-${etapa.etapaId}-${proprietario.nome}`}
                              >
                                {numeroBR(
                                  matriz.get(
                                    JSON.stringify([proprietario.nome, funil, etapa.etapaId])
                                  ) ?? 0,
                                  0
                                )}
                              </td>
                            ))
                          )}
                          <td className="evento-matriz__residual">
                            {numeroBR(foraDasEtapas(proprietario.nome, proprietario.total), 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <th className="evento-matriz__fixa evento-matriz__proprietario" scope="row">
                          Total
                        </th>
                        <td className="evento-matriz__fixa evento-matriz__total">
                          {numeroBR(dados.negociosAbertos, 0)}
                        </td>
                        {etapasPorFunil.flatMap(({ funil, etapas }) =>
                          etapas.map((etapa) => (
                            <td
                              className="evento-matriz__valor"
                              data-funil={funil === FUNNEL_LABEL.novosNegocios ? 'novos' : 'salabim'}
                              key={`${funil}-${etapa.etapaId}-total`}
                            >
                              {numeroBR(totalEtapa(funil, etapa.etapaId), 0)}
                            </td>
                          ))
                        )}
                        <td className="evento-matriz__residual">
                          {numeroBR(totalForaDasEtapas, 0)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <p className="evento-vazio">Nenhum negócio aberto com esta etiqueta.</p>
              )}
            </section>
          </div>
        );
      }}
    </Painel>
  );
}
