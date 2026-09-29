'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Painel, useApi } from '@/components/base';
import type { FunilClosersResposta } from '@/lib/types';

function TooltipEtapa({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { nome: string; total: number } }>;
}) {
  if (!active || !payload?.length) return null;
  const etapa = payload[0].payload;

  return (
    <div
      style={{
        background: 'var(--painel-alto)',
        border: '1px solid var(--borda)',
        borderRadius: 8,
        padding: '9px 12px',
        color: 'var(--texto)',
        fontSize: 12,
      }}
    >
      <strong>{etapa.nome}</strong>
      <div style={{ color: 'var(--texto-fraco)', marginTop: 4 }}>
        {etapa.total} {etapa.total === 1 ? 'negócio' : 'negócios'}
      </div>
    </div>
  );
}

export function CardFunilClosers() {
  const estado = useApi<FunilClosersResposta>('/api/funil-closers');

  return (
    <Painel titulo="Negócios por etapa · Salabim" estado={estado}>
      {(dados) => (
        <div>
          <div className="funil-closers-total">
            <strong className="medio">{dados.total}</strong>
            <span className="rotulo">negócios abertos no funil</span>
          </div>

          {dados.etapas.length > 0 ? (
            <div
              role="img"
              aria-label={`Negócios abertos por etapa no funil Salabim. Total: ${dados.total}.`}
              style={{ width: '100%', height: 320, marginTop: 12 }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dados.etapas}
                  margin={{ top: 22, right: 8, left: -12, bottom: 26 }}
                  accessibilityLayer
                >
                  <CartesianGrid stroke="var(--borda)" vertical={false} />
                  <XAxis
                    dataKey="nome"
                    interval={0}
                    angle={-12}
                    textAnchor="end"
                    height={62}
                    tick={{ fill: 'var(--texto-fraco)', fontSize: 11 }}
                    axisLine={{ stroke: 'var(--borda)' }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    width={42}
                    tick={{ fill: 'var(--texto-fraco)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<TooltipEtapa />} cursor={{ fill: 'var(--painel-alto)' }} />
                  <Bar
                    dataKey="total"
                    fill="var(--salabim)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={72}
                    isAnimationActive={false}
                  >
                    <LabelList
                      dataKey="total"
                      position="top"
                      fill="var(--texto)"
                      fontSize={12}
                      fontWeight={600}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="aviso">Nenhuma etapa ativa foi encontrada para o funil Salabim.</p>
          )}

          <p className="funil-closers-nota">
            Contagem atual de negócios abertos; a origem dos negócios ainda não está mapeada no painel.
          </p>
        </div>
      )}
    </Painel>
  );
}
