'use client';

import { useState } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AgendamentosMensaisResposta } from '@/lib/types';
import { Painel, useApi } from './base';

const numeroBR = new Intl.NumberFormat('pt-BR');

export function CardAgendamentosBI() {
  const [comparar, setComparar] = useState(false);
  const estado = useApi<AgendamentosMensaisResposta>('/api/agendamentos-bi?ano=2026');
  const estadoAnterior = useApi<AgendamentosMensaisResposta>('/api/agendamentos-bi?ano=2025', comparar);

  return (
    <Painel titulo="Agendamentos por mês · 2026" estado={estado}>
      {(dados) => {
        const totais = dados.meses.reduce(
          (soma, mes) => ({
            sdrs: soma.sdrs + mes.sdrs,
            closers: soma.closers + mes.closers,
            outros: soma.outros + mes.outros,
            total: soma.total + mes.total,
          }),
          { sdrs: 0, closers: 0, outros: 0, total: 0 }
        );

        const totaisAnteriores = (estadoAnterior.dados?.meses ?? []).reduce(
          (total, mes) => total + mes.total,
          0
        );
        const mesesAnteriores = new Map(
          (estadoAnterior.dados?.meses ?? []).map((mes) => [mes.mes.slice(5), mes.total])
        );
        const mesesGrafico = dados.meses.map((mes) => ({
          ...mes,
          totalAnterior: mesesAnteriores.get(mes.mes.slice(5)) ?? 0,
        }));

        return (
          <>
            <div className="bi-controles">
              <label className="bi-comparacao">
                <input
                  type="checkbox"
                  checked={comparar}
                  onChange={(evento) => setComparar(evento.target.checked)}
                />
                <span>Comparar com 2025</span>
              </label>
              {comparar && estadoAnterior.carregando && (
                <span className="bi-comparacao-status" role="status">
                  Carregando dados de 2025…
                </span>
              )}
              {comparar && estadoAnterior.erro && (
                <span className="bi-comparacao-erro" role="alert">
                  Comparação indisponível: {estadoAnterior.erro}
                </span>
              )}
            </div>

            <div className="bi-resumo">
              <div className="bi-total">
                <strong>{numeroBR.format(totais.total)}</strong>
                <span>agendamentos no ano</span>
              </div>
              <div className="bi-legenda" aria-label="Resumo por responsável">
                <span>
                  <i className="bi-cor" data-tipo="sdrs" aria-hidden="true" />
                  SDRs <strong>{numeroBR.format(totais.sdrs)}</strong>
                </span>
                <span>
                  <i className="bi-cor" data-tipo="closers" aria-hidden="true" />
                  Closers <strong>{numeroBR.format(totais.closers)}</strong>
                </span>
                {totais.outros > 0 && (
                  <span>
                    <i className="bi-cor" data-tipo="outros" aria-hidden="true" />
                    Outros <strong>{numeroBR.format(totais.outros)}</strong>
                  </span>
                )}
                {comparar && estadoAnterior.dados && (
                  <span>
                    <i className="bi-cor bi-cor-linha" aria-hidden="true" />
                    Total 2025 <strong>{numeroBR.format(totaisAnteriores)}</strong>
                  </span>
                )}
              </div>
            </div>

            <div
              className="bi-grafico"
              role="img"
              aria-label={`Agendamentos mensais de ${dados.ano}: ${numeroBR.format(
                totais.sdrs
              )} de SDRs, ${numeroBR.format(totais.closers)} de closers e ${numeroBR.format(
                totais.outros
              )} de outras atribuições.${
                comparar && estadoAnterior.dados
                  ? ` Linha de comparação: total mensal de ${estadoAnterior.dados.ano}.`
                  : ''
              }`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={mesesGrafico}
                  margin={{ top: 12, right: 8, bottom: 0, left: -16 }}
                  barCategoryGap="28%"
                  accessibilityLayer
                >
                  <CartesianGrid vertical={false} stroke="var(--borda)" />
                  <XAxis
                    dataKey="nome"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'var(--texto-fraco)', fontSize: 11 }}
                    interval={0}
                  />
                  <YAxis
                    allowDecimals={false}
                    domain={[0, 'dataMax + 5']}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'var(--texto-fraco)', fontSize: 11 }}
                    width={40}
                  />
                  <Tooltip
                    cursor={{ fill: 'var(--painel-alto)' }}
                    contentStyle={{
                      backgroundColor: 'var(--painel-alto)',
                      border: '1px solid var(--borda)',
                      borderRadius: 10,
                      color: 'var(--texto)',
                    }}
                    labelStyle={{ color: 'var(--texto)' }}
                    formatter={(valor, nome) => [numeroBR.format(Number(valor)), nome]}
                  />
                  <Bar
                    dataKey="sdrs"
                    name="SDRs"
                    stackId="agendamentos"
                    fill="var(--novos)"
                    maxBarSize={38}
                  />
                  <Bar
                    dataKey="closers"
                    name="Closers"
                    stackId="agendamentos"
                    fill="var(--salabim)"
                    maxBarSize={38}
                  />
                  <Bar
                    dataKey="outros"
                    name="Outros"
                    stackId="agendamentos"
                    fill="var(--texto-fraco)"
                    maxBarSize={38}
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    dataKey="total"
                    name="Total 2026"
                    stroke="transparent"
                    strokeWidth={0}
                    dot={false}
                    activeDot={false}
                    isAnimationActive={false}
                    legendType="none"
                  >
                    <LabelList
                      dataKey="total"
                      position="top"
                      offset={7}
                      fill="var(--texto-fraco)"
                      fontSize={11}
                      formatter={(valor) => numeroBR.format(Number(valor))}
                    />
                  </Line>
                  {comparar && estadoAnterior.dados && (
                    <Line
                      type="monotone"
                      dataKey="totalAnterior"
                      name="Total 2025"
                      stroke="var(--atencao)"
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      dot={{ r: 3, fill: 'var(--atencao)' }}
                      activeDot={{ r: 5 }}
                      connectNulls
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="bi-nota">
              Segue o critério dos cards atuais: reuniões concluídas vinculadas aos funis
              acompanhados, agrupadas pela data do agendamento. A atribuição usa o campo SDR do
              negócio ou, quando vazio, o proprietário. Registros sem atribuição única de SDR ou
              closer aparecem como Outros.
            </p>
          </>
        );
      }}
    </Painel>
  );
}
