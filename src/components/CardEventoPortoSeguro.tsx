'use client';

import { useState } from 'react';
import { ListaNegocios } from '@/components/CardFunilClosers';
import { Modal, NumeroClicavel, Painel, numeroBR, useApi } from '@/components/base';
import { FUNNEL_LABEL } from '@/lib/config';
import type { ItemNegocioEtapa, MetricasEventoPortoSeguroResposta } from '@/lib/types';

interface DetalheEvento {
  titulo: string;
  negocios: ItemNegocioEtapa[];
}

function quantidadeNegocios(total: number): string {
  return `${total} ${total === 1 ? 'negócio' : 'negócios'}`;
}

export function CardEventoPortoSeguro() {
  const estado = useApi<MetricasEventoPortoSeguroResposta>('/api/evento-porto-seguro');
  const [detalhe, setDetalhe] = useState<DetalheEvento | null>(null);

  return (
    <>
      <Painel titulo="Evento Porto Seguro" estado={estado}>
        {(dados) => {
          const nomeFunil = FUNNEL_LABEL.novosNegocios;
          const etapas = dados.negociosPorEtapa
            .filter((item) => item.funil === nomeFunil)
            .sort((a, b) => a.ordem - b.ordem);
          const celulas = dados.negociosPorProprietarioEtapa.filter(
            (item) => item.funil === nomeFunil
          );
          const matriz = new Map(
            celulas.map((item) => [JSON.stringify([item.proprietario, item.etapaId]), item])
          );
          const negociosDoProprietario = (nome: string) =>
            celulas
              .filter((item) => item.proprietario === nome)
              .flatMap((item) => item.negocios);
          const negociosDaEtapa = (etapaId: number) =>
            celulas.filter((item) => item.etapaId === etapaId).flatMap((item) => item.negocios);
          const todosOsNegocios = celulas.flatMap((item) => item.negocios);
          const abrirDetalhe = (titulo: string, negocios: ItemNegocioEtapa[]) =>
            setDetalhe({ titulo, negocios });
          return (
            <div className="evento-conteudo" aria-label="Métricas da etiqueta Evento Porto Seguro">
              <div className="evento-metricas">
                <div className="evento-metrica">
                  <strong className="numero grande" aria-label={`${dados.leads} leads`}>
                    {numeroBR(dados.leads, 0)}
                  </strong>
                  <span>Leads com a etiqueta</span>
                </div>
                <div className="evento-metrica">
                  <NumeroClicavel
                    valor={numeroBR(dados.negociosAbertos, 0)}
                    classe="numero grande"
                    aoAbrir={() => abrirDetalhe('Todos os negócios', todosOsNegocios)}
                    titulo={`Ver todos os ${quantidadeNegocios(dados.negociosAbertos)} do funil ${nomeFunil}`}
                    ariaLabel={`Ver todos os ${dados.negociosAbertos} negócios abertos no funil ${nomeFunil}`}
                    desabilitado={dados.negociosAbertos === 0}
                  />
                  <span>Negócios em aberto · {nomeFunil}</span>
                </div>
              </div>

              <section className="evento-distribuicao" aria-labelledby="evento-distribuicao-titulo">
                <div className="evento-distribuicao__cabecalho">
                  <h3 id="evento-distribuicao-titulo">
                    Negócios por proprietário e etapa · {nomeFunil}
                  </h3>
                  <p>Clique em uma contagem positiva para ver os negócios correspondentes.</p>
                </div>

                {dados.negociosPorProprietario.length > 0 ? (
                  <div
                    className="evento-matriz__rolagem"
                    role="region"
                    aria-label={`Negócios por proprietário e etapa no funil ${nomeFunil}`}
                    tabIndex={0}
                  >
                    <table className="evento-matriz">
                      <caption className="evento-matriz__legenda">
                        Contagens apenas do funil {nomeFunil}. Clique em um número para abrir a lista de negócios.
                      </caption>
                      <thead>
                        <tr>
                          <th
                            className="evento-matriz__fixa evento-matriz__proprietario"
                            scope="col"
                            rowSpan={2}
                          >
                            Proprietário
                          </th>
                          <th
                            className="evento-matriz__fixa evento-matriz__total"
                            scope="col"
                            rowSpan={2}
                          >
                            Total
                          </th>
                          <th className="evento-matriz__grupo" colSpan={etapas.length} scope="colgroup">
                            {nomeFunil}
                          </th>
                        </tr>
                        <tr>
                          {etapas.map((etapa) => (
                            <th className="evento-matriz__etapa" key={etapa.etapaId} scope="col">
                              {etapa.etapa}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {dados.negociosPorProprietario.map((proprietario) => {
                          const negocios = negociosDoProprietario(proprietario.nome);
                          return (
                            <tr key={proprietario.nome}>
                              <th
                                className="evento-matriz__fixa evento-matriz__proprietario"
                                scope="row"
                              >
                                {proprietario.nome}
                              </th>
                              <td className="evento-matriz__fixa evento-matriz__total">
                                <NumeroClicavel
                                  valor={numeroBR(proprietario.total, 0)}
                                  classe="evento-matriz__numero"
                                  aoAbrir={() =>
                                    abrirDetalhe(
                                      `${proprietario.nome} · todos os negócios`,
                                      negocios
                                    )
                                  }
                                  titulo={`Ver os ${quantidadeNegocios(proprietario.total)} de ${proprietario.nome} no funil ${nomeFunil}`}
                                  ariaLabel={`Ver os ${proprietario.total} negócios de ${proprietario.nome} no funil ${nomeFunil}`}
                                  desabilitado={proprietario.total === 0}
                                />
                              </td>
                              {etapas.map((etapa) => {
                                const celula = matriz.get(
                                  JSON.stringify([proprietario.nome, etapa.etapaId])
                                );
                                const total = celula?.total ?? 0;
                                return (
                                  <td
                                    className="evento-matriz__valor"
                                    key={`${etapa.etapaId}-${proprietario.nome}`}
                                  >
                                    <NumeroClicavel
                                      valor={numeroBR(total, 0)}
                                      classe="evento-matriz__numero"
                                      cor="var(--novos)"
                                      aoAbrir={() =>
                                        abrirDetalhe(
                                          `${proprietario.nome} · ${etapa.etapa}`,
                                          celula?.negocios ?? []
                                        )
                                      }
                                      titulo={`Ver os ${quantidadeNegocios(total)} de ${proprietario.nome} em ${etapa.etapa}`}
                                      ariaLabel={`Ver os ${total} negócios de ${proprietario.nome} na etapa ${etapa.etapa}`}
                                      desabilitado={total === 0}
                                    />
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr>
                          <th
                            className="evento-matriz__fixa evento-matriz__proprietario"
                            scope="row"
                          >
                            Total
                          </th>
                          <td className="evento-matriz__fixa evento-matriz__total">
                            <NumeroClicavel
                              valor={numeroBR(dados.negociosAbertos, 0)}
                              classe="evento-matriz__numero"
                              aoAbrir={() => abrirDetalhe('Todos os negócios', todosOsNegocios)}
                              titulo={`Ver todos os ${quantidadeNegocios(dados.negociosAbertos)} do funil ${nomeFunil}`}
                              ariaLabel={`Ver todos os ${dados.negociosAbertos} negócios do funil ${nomeFunil}`}
                              desabilitado={dados.negociosAbertos === 0}
                            />
                          </td>
                          {etapas.map((etapa) => (
                            <td className="evento-matriz__valor" key={`${etapa.etapaId}-total`}>
                              <NumeroClicavel
                                valor={numeroBR(etapa.total, 0)}
                                classe="evento-matriz__numero"
                                cor="var(--novos)"
                                aoAbrir={() =>
                                  abrirDetalhe(`${etapa.etapa} · todos os proprietários`, negociosDaEtapa(etapa.etapaId))
                                }
                                titulo={`Ver os ${quantidadeNegocios(etapa.total)} na etapa ${etapa.etapa}`}
                                ariaLabel={`Ver os ${etapa.total} negócios na etapa ${etapa.etapa} de ${nomeFunil}`}
                                desabilitado={etapa.total === 0}
                              />
                            </td>
                          ))}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <p className="evento-vazio">Nenhum negócio aberto no funil {nomeFunil} com esta etiqueta.</p>
                )}
              </section>
            </div>
          );
        }}
      </Painel>

      {detalhe && (
        <Modal
          titulo={detalhe.titulo}
          subtitulo={`${FUNNEL_LABEL.novosNegocios} · ${quantidadeNegocios(detalhe.negocios.length)}`}
          aoFechar={() => setDetalhe(null)}
        >
          <ListaNegocios
            etapa={{
              id: 0,
              nome: detalhe.titulo,
              ordem: 0,
              total: detalhe.negocios.length,
              negocios: detalhe.negocios,
            }}
          />
        </Modal>
      )}
    </>
  );
}
