'use client';

import { useState } from 'react';

import {
  CORES_FUNIL,
  ETAPAS_ORDEM,
  ETAPA_LABEL,
  etapaExiste,
  FUNNEL_LABEL,
  MOSTRAR_NOTAS,
  SDRS,
  type FunnelKey,
} from '@/lib/config';
import { hoje, nomeDoMes, ritmoDoMes } from '@/lib/dates';
import {
  TEMPERATURA_LABEL,
  cadenciaNecessaria,
  classificarRitmo,
  textoCadencia,
  textoRestante,
} from '@/lib/metrics';
import type { AgendamentosResposta, FunilResposta } from '@/lib/types';
import type { Recorte } from '@/lib/detalhe';
import {
  BarraMeta,
  LegendaFunis,
  NumeroClicavel,
  Painel,
  pct,
  useApi,
  type Estado,
} from './base';
import { ModalDetalhe } from './CardsAgendamentos';

const FUNIS: FunnelKey[] = ['novosNegocios', 'salabim'];

/**
 * Card 3 — Detalhamento SDR. Sempre no mes corrente, mesmo que o filtro do topo
 * aponte para outro periodo: a meta e mensal, entao ritmo e temperatura so
 * fazem sentido contra o mes.
 */
export function CardDetalhamentoSdr({ estado }: { estado: Estado<AgendamentosResposta> }) {
  const ritmo = ritmoDoMes(hoje());
  const [detalhe, setDetalhe] = useState<{ titulo: string; recorte: Recorte } | null>(null);

  return (
    <>
      {SDRS.map((cfg) => (
        <Painel
          key={cfg.key}
          titulo={`Detalhamento · ${cfg.nome}`}
          periodo={
            nomeDoMes(ritmo.inicio) +
            ' · ' +
            ritmo.restantes +
            (ritmo.restantes === 1 ? ' dia útil restante' : ' dias úteis restantes')
          }
          estado={estado}
        >
          {(d) => {
            const sdr = d.porSdr.find((x) => x.sdr === cfg.key);
            if (!sdr) return <div className="estado">Sem dados.</div>;

            return (
              <div style={{ display: 'grid', gap: 20 }}>
                {FUNIS.map((f) => {
                  const realizado = sdr.porFunil[f];
                  const meta = sdr.metas[f];
                  const { temperatura, esperadoExibido } = classificarRitmo(
                    realizado,
                    meta,
                    ritmo.decorridos,
                    ritmo.totais
                  );
                  const cadencia = cadenciaNecessaria(realizado, meta, ritmo.restantes);
                  const restante = textoRestante(cadencia);

                  return (
                    <div key={f}>
                      <div className="linha-meta">
                        <span className="rotulo">{FUNNEL_LABEL[f]}</span>
                        <span className="selo" data-t={temperatura}>
                          {TEMPERATURA_LABEL[temperatura]}
                        </span>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'baseline',
                          gap: 8,
                          margin: '2px 0 8px',
                        }}
                      >
                        <NumeroClicavel
                          valor={realizado}
                          classe="numero medio"
                          cor={CORES_FUNIL[f]}
                          aoAbrir={() =>
                            setDetalhe({
                              titulo: `${cfg.nome} · ${FUNNEL_LABEL[f]} · ${nomeDoMes(ritmo.inicio)}`,
                              recorte: { sdr: cfg.key, funil: f, unidade: d.unidade },
                            })
                          }
                          titulo={`Ver os ${realizado} agendamentos de ${cfg.nome} em ${FUNNEL_LABEL[f]}`}
                          desabilitado={realizado === 0}
                        />
                        <span className="rotulo">de {meta}</span>
                      </div>

                      <BarraMeta valor={realizado} meta={meta} cor={CORES_FUNIL[f]} />

                      <div
                        style={{
                          display: 'flex',
                          gap: 20,
                          marginTop: 9,
                          fontSize: 12,
                          color: 'var(--texto-fraco)',
                        }}
                      >
                        <span>
                          Ritmo necessário:{' '}
                          <strong style={{ color: 'var(--texto)' }}>
                            {textoCadencia(cadencia)}
                          </strong>
                          {restante && <span> · {restante}</span>}
                        </span>
                        <span>
                          Esperado até hoje:{' '}
                          <strong style={{ color: 'var(--texto)' }}>{esperadoExibido}</strong>
                        </span>
                      </div>
                    </div>
                  );
                })}

                {MOSTRAR_NOTAS && (
                  <p className="nota">
                    {ritmo.decorridos} de {ritmo.totais} dias úteis do mês já passaram. O esperado
                    até hoje distribui a meta por igual entre os dias úteis e é arredondado para o
                    inteiro mais próximo; as faixas de “no ritmo” são ±10% em torno do valor exato.
                    O ritmo necessário arredonda sempre para cima — para baixo seria uma meta que
                    não fecha.
                  </p>
                )}
              </div>
            );
          }}
        </Painel>
      ))}

      {detalhe && estado.dados && (
        <ModalDetalhe detalhe={detalhe} dados={estado.dados} aoFechar={() => setDetalhe(null)} />
      )}
    </>
  );
}

/** Card 4 — Funil por SDR. */
export function CardFunilSdr() {
  const estado = useApi<FunilResposta>('/api/funil');

  return (
    <>
      {SDRS.map((cfg) => (
        <Painel
          key={cfg.key}
          titulo={`Funil · ${cfg.nome}`}
          periodo="negócios abertos, agora"
          estado={estado}
        >
          {(d) => {
            const sdr = d.porSdr.find((x) => x.sdr === cfg.key);
            if (!sdr) return <div className="estado">Sem dados.</div>;

            return (
              <div style={{ display: 'grid', gap: 18 }}>
                <table className="tabela">
                  <thead>
                    <tr>
                      <th>Etapa</th>
                      {FUNIS.map((f) => (
                        <th key={f} className="num" style={{ textAlign: 'right' }}>
                          {FUNNEL_LABEL[f]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ETAPAS_ORDEM.map((etapa) => (
                      <tr key={etapa}>
                        <td>{ETAPA_LABEL[etapa]}</td>
                        {FUNIS.map((f) => (
                          <td
                            key={f}
                            className="num"
                            // "-" quando a etapa nao existe naquele funil: o
                            // Salabim nao tem Pre Qualificacao, e mostrar 0 ali
                            // sugeriria uma etapa vazia em vez de inexistente.
                            title={etapaExiste(f, etapa) ? undefined : 'Etapa não existe neste funil'}
                          >
                            {etapaExiste(f, etapa) ? (
                              sdr.funis[f].etapas[etapa]
                            ) : (
                              <span style={{ color: 'var(--texto-fraco)' }}>—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div>
                  <div className="linha-meta">
                    <span className="rotulo">Saúde dos negócios</span>
                    <span className="rotulo">exclui Pré Qualificação</span>
                  </div>

                  <table className="tabela">
                    <tbody>
                      {(
                        [
                          ['emDia', 'Em dia', 'var(--salabim)'],
                          ['atrasado', 'Atrasado', 'var(--alerta)'],
                          ['semAtividade', 'Sem atividade', 'var(--texto-fraco)'],
                        ] as const
                      ).map(([k, label, cor]) => (
                        <tr key={k}>
                          <td style={{ color: cor }}>{label}</td>
                          {FUNIS.map((f) => (
                            <td key={f} className="num">
                              {sdr.funis[f].saude[k]}
                            </td>
                          ))}
                        </tr>
                      ))}
                      <tr>
                        <td className="rotulo">Índice de saúde</td>
                        {FUNIS.map((f) => (
                          <td key={f} className="num">
                            {sdr.funis[f].indiceSaude === null
                              ? '—'
                              : pct(sdr.funis[f].indiceSaude as number)}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>

                <LegendaFunis />

                {MOSTRAR_NOTAS && (
                  <p className="nota">
                    Aqui a atribuição é pelo <strong>proprietário do negócio</strong>, não pelo
                    campo SDR — nas etapas iniciais o negócio ainda está com a SDR. Nos cards de
                    agendamento é o contrário, porque depois da reunião o negócio passa para um
                    closer e só o campo SDR preserva quem originou.
                  </p>
                )}
              </div>
            );
          }}
        </Painel>
      ))}
    </>
  );
}
