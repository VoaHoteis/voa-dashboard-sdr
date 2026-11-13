'use client';

import { useState } from 'react';
import { ListaNegocios } from '@/components/CardFunilClosers';
import { CardNegociosPerdidosEvento } from '@/components/CardNegociosPerdidosEvento';
import { Modal, NumeroClicavel, Painel, numeroBR, useApi } from '@/components/base';
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
          const etapas = dados.negociosPorEtapa
            .filter((etapa) => etapa.funil !== 'Salabim')
            .sort(
              (a, b) => a.funil.localeCompare(b.funil, 'pt-BR') || a.ordem - b.ordem
            );
          const funis = [...new Set(etapas.map((item) => item.funil))];
          const gruposEtapas = funis.map((funil) => ({
            funil,
            etapas: etapas.filter((etapa) => etapa.funil === funil),
          }));
          const todasCelulas = dados.negociosPorProprietarioEtapa;
          const celulas = todasCelulas.filter((item) => item.funil !== 'Salabim');
          const proprietarios = dados.negociosPorProprietario
            .map((proprietario) => ({
              nome: proprietario.nome,
              total: celulas
                .filter((item) => item.proprietario === proprietario.nome)
                .reduce((total, item) => total + item.total, 0),
            }))
            .filter((proprietario) => proprietario.total > 0);
          const totalVisivel = etapas.reduce((total, etapa) => total + etapa.total, 0);
          const matriz = new Map(
            celulas.map((item) => [
              JSON.stringify([item.proprietario, item.funil, item.etapaId]),
              item,
            ])
          );
          const negociosDoProprietario = (nome: string) =>
            celulas
              .filter((item) => item.proprietario === nome)
              .flatMap((item) => item.negocios);
          const negociosDaEtapa = (funil: string, etapaId: number) =>
            celulas
              .filter((item) => item.funil === funil && item.etapaId === etapaId)
              .flatMap((item) => item.negocios);
          const todosOsNegocios = todasCelulas.flatMap((item) => item.negocios);
          const totalAtividades = dados.atividadesPorPessoa.reduce(
            (total, pessoa) => ({
              hoje: total.hoje + pessoa.hoje,
              semana: total.semana + pessoa.semana,
              mes: total.mes + pessoa.mes,
            }),
            { hoje: 0, semana: 0, mes: 0 }
          );
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
                    titulo={`Ver todos os ${quantidadeNegocios(dados.negociosAbertos)} com a etiqueta`}
                    ariaLabel={`Ver todos os ${dados.negociosAbertos} negócios abertos com a etiqueta Evento Porto Seguro`}
                    desabilitado={dados.negociosAbertos === 0}
                  />
                  <span>Negócios em aberto com etiqueta</span>
                </div>
              </div>

              <CardNegociosPerdidosEvento dados={dados.negociosPerdidos} />

              <section className="evento-distribuicao" aria-labelledby="evento-distribuicao-titulo">
                <div className="evento-distribuicao__cabecalho">
                  <h3 id="evento-distribuicao-titulo">
                    Negócios por proprietário, funil e etapa
                  </h3>
                  <p>Clique em uma contagem positiva para ver os negócios correspondentes.</p>
                </div>

                {proprietarios.length > 0 ? (
                  <div
                    className="evento-matriz__rolagem"
                    role="region"
                    aria-label="Negócios por proprietário, funil e etapa com a etiqueta Evento Porto Seguro"
                    tabIndex={0}
                  >
                    <table className="evento-matriz">
                      <caption className="evento-matriz__legenda">
                        Negócios abertos com a etiqueta, exceto Salabim, agrupados por proprietário e etapa. Clique em um número para abrir a lista.
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
                          {gruposEtapas.map((grupo) => (
                            <th
                              className="evento-matriz__grupo"
                              colSpan={grupo.etapas.length}
                              key={grupo.funil}
                              scope="colgroup"
                            >
                              {grupo.funil}
                            </th>
                          ))}
                        </tr>
                        <tr>
                          {etapas.map((etapa) => (
                            <th
                              className="evento-matriz__etapa"
                              key={`${etapa.funil}-${etapa.etapaId}`}
                              scope="col"
                            >
                              {etapa.etapa}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {proprietarios.map((proprietario) => {
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
                                  titulo={`Ver os ${quantidadeNegocios(proprietario.total)} de ${proprietario.nome} com a etiqueta`}
                                  ariaLabel={`Ver os ${proprietario.total} negócios de ${proprietario.nome} com a etiqueta Evento Porto Seguro`}
                                  desabilitado={proprietario.total === 0}
                                />
                              </td>
                              {etapas.map((etapa) => {
                                const celula = matriz.get(
                                  JSON.stringify([proprietario.nome, etapa.funil, etapa.etapaId])
                                );
                                const total = celula?.total ?? 0;
                                return (
                                  <td
                                    className="evento-matriz__valor"
                                    key={`${etapa.funil}-${etapa.etapaId}-${proprietario.nome}`}
                                  >
                                    <NumeroClicavel
                                      valor={numeroBR(total, 0)}
                                      classe="evento-matriz__numero"
                                      cor="var(--novos)"
                                      aoAbrir={() =>
                                        abrirDetalhe(
                                          `${proprietario.nome} · ${etapa.funil} · ${etapa.etapa}`,
                                          celula?.negocios ?? []
                                        )
                                      }
                                      titulo={`Ver os ${quantidadeNegocios(total)} de ${proprietario.nome} em ${etapa.funil} · ${etapa.etapa}`}
                                      ariaLabel={`Ver os ${total} negócios de ${proprietario.nome} na etapa ${etapa.etapa} do funil ${etapa.funil}`}
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
                              valor={numeroBR(totalVisivel, 0)}
                              classe="evento-matriz__numero"
                              aoAbrir={() => abrirDetalhe('Todos os negócios', todosOsNegocios)}
                              titulo={`Ver todos os ${quantidadeNegocios(totalVisivel)} nos funis exibidos`}
                              ariaLabel={`Ver todos os ${totalVisivel} negócios nos funis exibidos com a etiqueta Evento Porto Seguro`}
                              desabilitado={totalVisivel === 0}
                            />
                          </td>
                          {etapas.map((etapa) => (
                            <td
                              className="evento-matriz__valor"
                              key={`${etapa.funil}-${etapa.etapaId}-total`}
                            >
                              <NumeroClicavel
                                valor={numeroBR(etapa.total, 0)}
                                classe="evento-matriz__numero"
                                cor="var(--novos)"
                                aoAbrir={() =>
                                  abrirDetalhe(
                                    `${etapa.funil} · ${etapa.etapa} · todos os proprietários`,
                                    negociosDaEtapa(etapa.funil, etapa.etapaId)
                                  )
                                }
                                titulo={`Ver os ${quantidadeNegocios(etapa.total)} em ${etapa.funil} · ${etapa.etapa}`}
                                ariaLabel={`Ver os ${etapa.total} negócios na etapa ${etapa.etapa} do funil ${etapa.funil}`}
                                desabilitado={etapa.total === 0}
                              />
                            </td>
                          ))}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <p className="evento-vazio">Nenhum negócio aberto com esta etiqueta nos funis acompanhados.</p>
                )}
              </section>

              <section className="evento-distribuicao" aria-labelledby="evento-atividades-titulo">
                <div className="evento-distribuicao__cabecalho">
                  <h3 id="evento-atividades-titulo">Atividades por pessoa</h3>
                  <p>Concluídas em negócios abertos com a etiqueta · Semana de segunda a hoje</p>
                </div>
                <div
                  className="evento-matriz__rolagem"
                  role="region"
                  aria-label="Atividades por pessoa nos negócios do Evento Porto Seguro"
                  tabIndex={0}
                >
                  <table className="evento-matriz evento-atividades__tabela">
                    <caption className="evento-matriz__legenda">
                      Quantidade de atividades concluídas vinculadas aos negócios abertos com a etiqueta Evento Porto Seguro.
                    </caption>
                    <thead>
                      <tr>
                        <th
                          className="evento-matriz__fixa evento-matriz__proprietario"
                          scope="col"
                        >
                          Pessoa
                        </th>
                        <th className="evento-matriz__etapa" scope="col">Hoje</th>
                        <th className="evento-matriz__etapa" scope="col">Semana</th>
                        <th className="evento-matriz__etapa" scope="col">Mês</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dados.atividadesPorPessoa.map((pessoa) => (
                        <tr key={pessoa.pessoa}>
                          <th
                            className="evento-matriz__fixa evento-matriz__proprietario"
                            scope="row"
                          >
                            {pessoa.pessoa}
                          </th>
                          <td className="evento-matriz__valor">{numeroBR(pessoa.hoje, 0)}</td>
                          <td className="evento-matriz__valor">{numeroBR(pessoa.semana, 0)}</td>
                          <td className="evento-matriz__valor">{numeroBR(pessoa.mes, 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <th
                          className="evento-matriz__fixa evento-matriz__proprietario"
                          scope="row"
                        >
                          Total
                        </th>
                        <td className="evento-matriz__valor">{numeroBR(totalAtividades.hoje, 0)}</td>
                        <td className="evento-matriz__valor">{numeroBR(totalAtividades.semana, 0)}</td>
                        <td className="evento-matriz__valor">{numeroBR(totalAtividades.mes, 0)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </section>
            </div>
          );
        }}
      </Painel>

      {detalhe && (
        <Modal
          titulo={detalhe.titulo}
          subtitulo={`${quantidadeNegocios(detalhe.negocios.length)} com a etiqueta`}
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
