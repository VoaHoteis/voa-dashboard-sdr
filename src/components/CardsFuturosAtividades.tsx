'use client';

import { useState } from 'react';

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CORES_FUNIL,
  FUNNEL_LABEL,
  MOSTRAR_NOTAS,
  SDRS,
  TIPOS_ESFORCO,
  type FunnelKey,
} from '@/lib/config';
import { formatarBR, hoje, nomeDoMes } from '@/lib/dates';
import { nomeDaSdr } from '@/lib/metrics';
import { filtrarItens, type Recorte } from '@/lib/detalhe';
import type {
  AgendamentosResposta,
  AtividadesResposta,
  FuturosResposta,
  ItemAgendamento,
} from '@/lib/types';
import {
  BarraFunis,
  LegendaFunis,
  Modal,
  NumeroClicavel,
  Painel,
  useApi,
  type Estado,
} from './base';
import { TabelaNegocios } from './TabelaNegocios';

const FUNIS: FunnelKey[] = ['novosNegocios', 'salabim'];

/**
 * Card 5 — Agendamentos Futuros. As duas SDRs juntas.
 *
 * Recebe os dados do mes corrente (card 1) para montar a projecao. Se o card 1
 * ainda nao respondeu, a projecao fica em suspenso em vez de mostrar so o numero
 * futuro como se fosse o mes inteiro.
 */
export function CardAgendamentosFuturos({
  mes,
  estado,
}: {
  mes: AgendamentosResposta | null;
  estado: Estado<FuturosResposta>;
}) {
  const [detalhe, setDetalhe] = useState<{ titulo: string; itens: ItemAgendamento[] } | null>(null);
  const realizadoNoMes = mes?.time.total ?? null;

  return (
    <>
    <Painel
      titulo="Agendamentos Futuros"
      periodo={`de hoje até ${formatarBR(estado.dados?.ateFim ?? hoje())}`}
      estado={estado}
    >
      {(d) => (
        <>
          <div style={{ display: 'flex', gap: 40, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div>
              <NumeroClicavel
                valor={d.total}
                aoAbrir={() =>
                  setDetalhe({ titulo: 'Reuniões já marcadas', itens: d.itens })
                }
                titulo="Ver as reuniões já marcadas"
                desabilitado={d.total === 0}
              />
              <div className="rotulo" style={{ marginTop: 6 }}>
                reuniões já marcadas
              </div>
            </div>

            <div>
              <NumeroClicavel
                valor={realizadoNoMes === null ? '—' : realizadoNoMes + d.total}
                cor="var(--salabim)"
                aoAbrir={() =>
                  setDetalhe({
                    titulo: 'Projeção do mês — feitos e marcados',
                    // Os feitos vem do card 1 (mes corrente); os marcados, daqui.
                    itens: [...(mes ? filtrarItens(mes.itens, { unidade: mes.unidade }) : []), ...d.itens],
                  })
                }
                titulo="Ver os agendamentos feitos e os já marcados"
                desabilitado={realizadoNoMes === null}
              />
              <div className="rotulo" style={{ marginTop: 6 }}>
                projeção do mês
                {realizadoNoMes !== null && ` (${realizadoNoMes} feitos + ${d.total} marcados)`}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <BarraFunis salabim={d.porFunil.salabim} novos={d.porFunil.novosNegocios} />
            <div style={{ display: 'flex', gap: 28, marginTop: 12 }}>
              {FUNIS.map((f) => (
                <div key={f}>
                  <NumeroClicavel
                    valor={d.porFunil[f]}
                    classe="numero medio"
                    cor={CORES_FUNIL[f]}
                    aoAbrir={() =>
                      setDetalhe({
                        titulo: `Reuniões marcadas · ${FUNNEL_LABEL[f]}`,
                        itens: filtrarItens(d.itens, { funil: f } as Recorte),
                      })
                    }
                    titulo={`Ver as reuniões marcadas de ${FUNNEL_LABEL[f]}`}
                    desabilitado={d.porFunil[f] === 0}
                  />
                  <span className="rotulo"> {FUNNEL_LABEL[f]}</span>
                </div>
              ))}
            </div>
          </div>

          {d.itens.length > 0 ? (
            <div className="rolagem" style={{ marginTop: 20 }}>
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Negócio</th>
                    <th>Data</th>
                    <th>Funil</th>
                    <th>SDR</th>
                  </tr>
                </thead>
                <tbody>
                  {d.itens.map((i) => (
                    <tr key={i.atividadeId}>
                      <td>{i.titulo}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatarBR(i.data)}</td>
                      <td
                        style={{
                          color: i.funil ? CORES_FUNIL[i.funil] : 'var(--texto-fraco)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {i.funil ? FUNNEL_LABEL[i.funil] : '—'}
                      </td>
                      <td>{i.sdrs.length ? i.sdrs.map(nomeDaSdr).join(', ') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="nota">Nenhuma reunião marcada daqui até o fim do mês.</p>
          )}

          <LegendaFunis />
        </>
      )}
    </Painel>

      {detalhe && (
        <Modal
          titulo={detalhe.titulo}
          subtitulo={`${detalhe.itens.length} ${
            detalhe.itens.length === 1 ? 'registro' : 'registros'
          }`}
          aoFechar={() => setDetalhe(null)}
        >
          <TabelaNegocios itens={detalhe.itens} />
        </Modal>
      )}
    </>
  );
}

/** Card 6 — Atividades por semana, uma barra empilhada por semana do mes. */
export function CardsAtividadesSemana() {
  const estado = useApi<AtividadesResposta>('/api/atividades');

  return (
    <>
      {SDRS.map((cfg) => (
        <Painel
          key={cfg.key}
          titulo={`Atividades · ${cfg.nome}`}
          periodo={nomeDoMes(estado.dados?.mes.inicio ?? hoje())}
          estado={estado}
        >
          {(d) => {
            const sdr = d.porSdr.find((x) => x.sdr === cfg.key);
            if (!sdr) return <div className="estado">Sem dados.</div>;

            return (
              <>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  <span className="numero medio">{sdr.total}</span>
                  <span className="rotulo">atividades concluídas no mês</span>
                </div>

                <div style={{ height: 230, marginTop: 16 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sdr.series} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                      <CartesianGrid stroke="#20241c" vertical={false} />
                      <XAxis
                        dataKey="semana"
                        tick={{ fill: '#8a9080', fontSize: 11 }}
                        axisLine={{ stroke: '#232720' }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: '#8a9080', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip
                        cursor={{ fill: '#ffffff0d' }}
                        contentStyle={{
                          background: '#191c17',
                          border: '1px solid #232720',
                          borderRadius: 10,
                          fontSize: 12,
                        }}
                        labelStyle={{ color: '#f1f3ed' }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11, color: '#8a9080' }} iconSize={9} />
                      {TIPOS_ESFORCO.map((t, i) => (
                        <Bar
                          key={t.key}
                          dataKey={t.key}
                          name={t.label}
                          stackId="esforco"
                          fill={t.cor}
                        >
                          {/* O total vai só na última barra da pilha (o topo),
                              somando todos os tipos daquela semana. */}
                          {i === TIPOS_ESFORCO.length - 1 && (
                            <LabelList
                              position="top"
                              content={({ x, y, width, index }) => {
                                if (index == null) return null;
                                const linha = sdr.series[index];
                                const total = TIPOS_ESFORCO.reduce(
                                  (acc, tt) => acc + (Number(linha?.[tt.key]) || 0),
                                  0
                                );
                                if (!total) return null;
                                const cx = Number(x) + Number(width) / 2;
                                return (
                                  <text
                                    x={cx}
                                    y={Number(y) - 6}
                                    fill="#f1f3ed"
                                    fontSize={12}
                                    fontWeight={600}
                                    textAnchor="middle"
                                  >
                                    {total}
                                  </text>
                                );
                              }}
                            />
                          )}
                        </Bar>
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {MOSTRAR_NOTAS && (
                  <p className="nota">
                    Atribuição pelo <strong>executor da atividade</strong> (usuário do Pipedrive),
                    não pelo campo SDR do negócio — aqui a pergunta é quanto esforço a pessoa fez.
                  </p>
                )}
              </>
            );
          }}
        </Painel>
      ))}
    </>
  );
}
