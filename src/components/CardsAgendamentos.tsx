'use client';

import { useState } from 'react';
import {
  CORES_FUNIL,
  FUNNEL_LABEL,
  METAS_TIME,
  META_TIME_TOTAL,
  MOSTRAR_NOTAS,
  type FunnelKey,
  type SdrKey,
} from '@/lib/config';
import { formatarBR } from '@/lib/dates';
import { contarProjecao, filtrarItens, type Recorte } from '@/lib/detalhe';
import type { AgendamentosResposta, FuturosResposta } from '@/lib/types';
import {
  BarraFunis,
  BarraMeta,
  LegendaFunis,
  Modal,
  NumeroClicavel,
  Painel,
  pct,
  useApi,
} from './base';
import { TabelaNegocios } from './TabelaNegocios';

const FUNIS: FunnelKey[] = ['novosNegocios', 'salabim'];

/** O que o modal esta mostrando no momento. */
interface Detalhe {
  titulo: string;
  recorte: Recorte;
}

export function CardAgendamentosTotais({ url }: { url: string }) {
  const estado = useApi<AgendamentosResposta>(url);
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);

  return (
    <>
      <Painel titulo="Agendamentos Totais" estado={estado}>
        {(d) => {
          const atingido = META_TIME_TOTAL > 0 ? d.time.total / META_TIME_TOTAL : 0;
          const divergem = d.time.total !== d.time.totalAlternativo;
          const abrir = (titulo: string, recorte: Recorte) =>
            setDetalhe({ titulo, recorte: { ...recorte, unidade: d.unidade } });

          return (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <NumeroClicavel
                  valor={d.time.total}
                  aoAbrir={() => abrir('Agendamentos do time', {})}
                  titulo="Ver os negócios que formam este número"
                />
                <span className="rotulo">
                  de {META_TIME_TOTAL} · {pct(atingido)} da meta do time
                  {/* Sem a nota de rodape, este vira o unico acesso ao recorte
                      "sem SDR" -- que e justamente o que precisa de correcao no
                      Pipedrive, entao nao pode sumir junto com a nota. */}
                  {!MOSTRAR_NOTAS && d.semSdr > 0 && (
                    <>
                      {' · '}
                      <button
                        className="link"
                        onClick={() => abrir('Agendamentos sem SDR preenchida', { semSdr: true })}
                        title="Estes negócios estão sem o campo SDR preenchido no Pipedrive"
                      >
                        {d.semSdr} sem SDR
                      </button>
                    </>
                  )}
                </span>
              </div>

              <div style={{ marginTop: 18 }}>
                <BarraMeta valor={d.time.total} meta={META_TIME_TOTAL} cor={CORES_FUNIL.salabim} />
              </div>

              <div style={{ marginTop: 22 }}>
                <div className="linha-meta">
                  <span className="rotulo">Proporção por funil</span>
                </div>
                <BarraFunis
                  salabim={d.time.porFunil.salabim}
                  novos={d.time.porFunil.novosNegocios}
                />
              </div>

              <div style={{ display: 'flex', gap: 28, marginTop: 18 }}>
                {FUNIS.map((f) => (
                  <div key={f}>
                    <NumeroClicavel
                      valor={d.time.porFunil[f]}
                      classe="numero medio"
                      cor={CORES_FUNIL[f]}
                      aoAbrir={() => abrir(`Agendamentos · ${FUNNEL_LABEL[f]}`, { funil: f })}
                      titulo={`Ver os negócios de ${FUNNEL_LABEL[f]}`}
                    />
                    <div className="rotulo" style={{ marginTop: 4 }}>
                      {FUNNEL_LABEL[f]} · meta {METAS_TIME[f]}
                    </div>
                  </div>
                ))}
              </div>

              <LegendaFunis />

              {MOSTRAR_NOTAS && (
              <p className="nota">
                Período por data de vencimento da atividade: {formatarBR(d.periodo.inicio)} a{' '}
                {formatarBR(d.periodo.fim)}. Contando{' '}
                <strong>{d.unidade === 'atividades' ? 'reuniões' : 'negócios distintos'}</strong>.
                {divergem && (
                  <>
                    {' '}
                    Pela outra unidade seriam <strong>{d.time.totalAlternativo}</strong> — a
                    diferença são hotéis com mais de uma reunião no período.
                  </>
                )}
                {d.semSdr > 0 && (
                  <>
                    {' '}
                    <button
                      className="link"
                      onClick={() => abrir('Agendamentos sem SDR preenchida', { semSdr: true })}
                    >
                      {d.semSdr} {d.semSdr === 1 ? 'reunião entrou' : 'reuniões entraram'}
                    </button>{' '}
                    no total do time sem SDR preenchida no negócio, então{' '}
                    {d.semSdr === 1 ? 'não aparece' : 'não aparecem'} no card por SDR.
                  </>
                )}
              </p>
              )}
            </>
          );
        }}
      </Painel>

      {detalhe && estado.dados && (
        <ModalDetalhe
          detalhe={detalhe}
          dados={estado.dados}
          aoFechar={() => setDetalhe(null)}
        />
      )}
    </>
  );
}

/**
 * `futuros` so vem preenchido quando o filtro do topo esta no mes corrente.
 * Projetar reunioes futuras sobre "mes passado" seria enganoso, entao nesse caso
 * a pagina manda null e a marca simplesmente nao aparece.
 */
export function CardAgendamentoPorSdr({
  url,
  futuros,
}: {
  url: string;
  futuros: FuturosResposta | null;
}) {
  const estado = useApi<AgendamentosResposta>(url);
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);

  return (
    <>
      <Painel titulo="Agendamento por SDR" estado={estado}>
        {(d) => {
          const abrir = (titulo: string, recorte: Recorte) =>
            setDetalhe({ titulo, recorte: { ...recorte, unidade: d.unidade } });

          return (
            <div style={{ display: 'grid', gap: 24 }}>
              {d.porSdr.map((s) => (
                <div key={s.sdr}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      marginBottom: 12,
                    }}
                  >
                    <strong style={{ fontSize: 14 }}>{s.nome}</strong>
                    <span className="rotulo">
                      <NumeroClicavel
                        valor={s.total}
                        classe="numero"
                        aoAbrir={() => abrir(`Agendamentos · ${s.nome}`, { sdr: s.sdr as SdrKey })}
                        titulo={`Ver todos os agendamentos de ${s.nome}`}
                        desabilitado={s.total === 0}
                      />{' '}
                      de {s.metas.novosNegocios + s.metas.salabim}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gap: 12 }}>
                    {FUNIS.map((f) => {
                      const bateu = s.porFunil[f] >= s.metas[f];
                      const recorte: Recorte = {
                        sdr: s.sdr as SdrKey,
                        funil: f,
                        unidade: d.unidade,
                      };
                      const projetado = futuros
                        ? contarProjecao(d.itens, futuros.itens, recorte)
                        : undefined;
                      const marcados =
                        projetado === undefined ? 0 : projetado - s.porFunil[f];
                      return (
                        <div key={f}>
                          <div className="linha-meta">
                            <span className="rotulo">{FUNNEL_LABEL[f]}</span>
                            <span>
                              <NumeroClicavel
                                valor={s.porFunil[f]}
                                classe="numero forte"
                                aoAbrir={() =>
                                  abrir(`${s.nome} · ${FUNNEL_LABEL[f]}`, {
                                    sdr: s.sdr as SdrKey,
                                    funil: f,
                                  })
                                }
                                titulo={`Ver os negócios de ${s.nome} em ${FUNNEL_LABEL[f]}`}
                                desabilitado={s.porFunil[f] === 0}
                              />
                              <span className="rotulo"> / {s.metas[f]}</span>
                              {bateu && (
                                <span
                                  className="selo"
                                  data-t="meta-batida"
                                  style={{ marginLeft: 8 }}
                                >
                                  meta batida
                                </span>
                              )}
                            </span>
                          </div>
                          <BarraMeta
                            valor={s.porFunil[f]}
                            meta={s.metas[f]}
                            cor={CORES_FUNIL[f]}
                            marca={projetado}
                            dica={
                              marcados > 0
                                ? `Tracejado: ${projetado} de ${s.metas[f]} se ${
                                    marcados === 1
                                      ? 'a reunião já marcada for confirmada'
                                      : `as ${marcados} reuniões já marcadas forem confirmadas`
                                  }`
                                : undefined
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {MOSTRAR_NOTAS && (
                <p className="nota">
                  Atribuição pelo campo <strong>SDR do negócio</strong>, não pelo dono da
                  atividade. Negócio com duas SDRs marcadas conta inteiro para as duas, então a
                  soma das SDRs pode passar do total do time.
                </p>
              )}
            </div>
          );
        }}
      </Painel>

      {detalhe && estado.dados && (
        <ModalDetalhe detalhe={detalhe} dados={estado.dados} aoFechar={() => setDetalhe(null)} />
      )}
    </>
  );
}

/** Modal com a lista que produziu o numero clicado. */
export function ModalDetalhe({
  detalhe,
  dados,
  aoFechar,
}: {
  detalhe: Detalhe;
  dados: AgendamentosResposta;
  aoFechar: () => void;
}) {
  const itens = filtrarItens(dados.itens, detalhe.recorte);

  return (
    <Modal
      titulo={detalhe.titulo}
      subtitulo={`${itens.length} ${itens.length === 1 ? 'registro' : 'registros'} · ${formatarBR(
        dados.periodo.inicio
      )} a ${formatarBR(dados.periodo.fim)} · contando ${
        dados.unidade === 'atividades' ? 'reuniões' : 'negócios distintos'
      }`}
      aoFechar={aoFechar}
    >
      <TabelaNegocios itens={itens} />
    </Modal>
  );
}
