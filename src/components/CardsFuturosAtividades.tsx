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
  EscopoAtividade,
  FuturosResposta,
  Granularidade,
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
                    <th className="num">U.Hs</th>
                    <th>Data</th>
                    <th>Funil</th>
                    <th>SDR</th>
                  </tr>
                </thead>
                <tbody>
                  {d.itens.map((i) => (
                    <tr key={i.atividadeId}>
                      <td>{i.titulo}</td>
                      <td className="num" style={{ whiteSpace: 'nowrap' }}>
                        {i.uhs ?? '—'}
                      </td>
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

const ESCOPOS_ATIVIDADE: { key: EscopoAtividade; label: string; cor: string }[] = [
  { key: 'total', label: 'Todas', cor: 'var(--texto)' },
  { key: 'novosNegocios', label: FUNNEL_LABEL.novosNegocios, cor: CORES_FUNIL.novosNegocios },
  { key: 'salabim', label: FUNNEL_LABEL.salabim, cor: CORES_FUNIL.salabim },
];

const GRANULARIDADES_ATIVIDADE: { key: Granularidade; label: string }[] = [
  { key: 'semana', label: 'Semana' },
  { key: 'mes', label: 'Mês' },
  { key: 'dia', label: 'Dia' },
];

/** Pequeno grupo de botões tipo filtro, reaproveitado pelos dois seletores do card. */
function FiltroPill<K extends string>({
  opcoes,
  ativo,
  aoEscolher,
  aria,
  corAtiva,
}: {
  opcoes: { key: K; label: string; cor?: string }[];
  ativo: K;
  aoEscolher: (key: K) => void;
  aria: string;
  corAtiva?: (key: K) => string;
}) {
  return (
    <div role="group" aria-label={aria} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {opcoes.map((op) => {
        const selecionado = op.key === ativo;
        const cor = corAtiva ? corAtiva(op.key) : op.cor ?? 'var(--texto)';
        return (
          <button
            key={op.key}
            type="button"
            onClick={() => aoEscolher(op.key)}
            aria-pressed={selecionado}
            style={{
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 0.2,
              padding: '4px 10px',
              borderRadius: 999,
              border: `1px solid ${selecionado ? cor : 'var(--borda)'}`,
              background: selecionado ? cor : 'transparent',
              color: selecionado ? (op.key === 'total' ? 'var(--fundo)' : '#0B0C0A') : 'var(--texto-fraco)',
              transition: 'all .12s ease',
            }}
          >
            {op.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Um card de atividades por SDR. Dois filtros independentes: a granularidade
 * das barras (semana, mês inteiro ou dia a dia — semana é o padrão ao abrir o
 * dashboard) e o recorte de funil (todas, Novos Negócios ou Salabim). A série
 * e o total exibidos trocam junto, sem nova consulta — a rota já manda todas
 * as combinações prontas.
 */
function GraficoAtividadesSdr({ sdr }: { sdr: AtividadesResposta['porSdr'][number] }) {
  const [granularidade, setGranularidade] = useState<Granularidade>('semana');
  const [escopo, setEscopo] = useState<EscopoAtividade>('total');
  const serie = sdr.series[granularidade][escopo];
  const diario = granularidade === 'dia';

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span className="numero medio">{sdr.totais[escopo]}</span>
        <span className="rotulo">
          atividades concluídas no mês
          {escopo !== 'total' && ` · ${FUNNEL_LABEL[escopo]}`}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
        <FiltroPill
          opcoes={GRANULARIDADES_ATIVIDADE}
          ativo={granularidade}
          aoEscolher={setGranularidade}
          aria="Filtrar atividades por período"
          corAtiva={() => 'var(--texto)'}
        />
        <FiltroPill
          opcoes={ESCOPOS_ATIVIDADE}
          ativo={escopo}
          aoEscolher={setEscopo}
          aria="Filtrar atividades por funil"
          corAtiva={(k) => ESCOPOS_ATIVIDADE.find((op) => op.key === k)!.cor}
        />
      </div>

      <div style={{ height: 230, marginTop: 16 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={serie}
            margin={{ top: 28, right: 8, bottom: diario ? 16 : 0, left: -20 }}
          >
            <CartesianGrid stroke="#20241c" vertical={false} />
            <XAxis
              dataKey="rotulo"
              tick={{ fill: '#8a9080', fontSize: 11 }}
              axisLine={{ stroke: '#232720' }}
              tickLine={false}
              interval={diario ? 1 : 0}
              angle={diario ? -45 : 0}
              textAnchor={diario ? 'end' : 'middle'}
              height={diario ? 34 : undefined}
            />
            <YAxis
              tick={{ fill: '#8a9080', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              domain={[0, (max: number) => Math.ceil((max * 1.18) / 10) * 10]}
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
            {TIPOS_ESFORCO.map((t) => (
              <Bar key={t.key} dataKey={t.key} name={t.label} stackId="esforco" fill={t.cor}>
                {/* O total da semana é desenhado uma única vez, no topo da pilha.
                    Cada barra só desenha o rótulo quando é o tipo mais alto com
                    valor > 0 naquela semana — aí o topo desse segmento é o topo
                    da coluna inteira, então o total aparece de forma confiável em
                    toda semana com atividade. A folga no eixo Y garante que o
                    número nunca seja cortado. */}
                <LabelList
                  dataKey={t.key}
                  position="top"
                  content={({ x, y, width, index }) => {
                    if (index == null) return null;
                    const linha = serie[index];
                    if (!linha) return null;
                    const topo = [...TIPOS_ESFORCO]
                      .reverse()
                      .find((tt) => (Number(linha[tt.key]) || 0) > 0);
                    if (!topo || topo.key !== t.key) return null;
                    const total = TIPOS_ESFORCO.reduce(
                      (acc, tt) => acc + (Number(linha[tt.key]) || 0),
                      0
                    );
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
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {MOSTRAR_NOTAS && (
        <p className="nota">
          Atribuição pelo <strong>executor da atividade</strong> (usuário do Pipedrive), não pelo
          campo SDR do negócio — aqui a pergunta é quanto esforço a pessoa fez. O recorte por funil
          usa o negócio vinculado à atividade; atividade sem negócio entra só em “Todas”.
        </p>
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
            return <GraficoAtividadesSdr sdr={sdr} />;
          }}
        </Painel>
      ))}
    </>
  );
}
