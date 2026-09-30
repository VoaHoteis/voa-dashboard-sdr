'use client';

import { useState } from 'react';
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
import { Modal, Painel, useApi } from '@/components/base';
import { linkDoNegocio } from '@/lib/detalhe';
import type { FunilClosersResposta } from '@/lib/types';

type EtapaFunil = FunilClosersResposta['etapas'][number];

function TooltipEtapa({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: EtapaFunil }>;
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
        {etapa.total} {etapa.total === 1 ? 'negócio' : 'negócios'} · clique para ver a lista
      </div>
    </div>
  );
}

function TickEtapa({
  x = 0,
  y = 0,
  payload,
  aoSelecionar,
}: {
  x?: number;
  y?: number;
  payload?: { value?: string };
  aoSelecionar: (nome: string) => void;
}) {
  const nome = payload?.value ?? '';
  const selecionar = () => aoSelecionar(nome);
  const linhas = quebrarRotulo(nome);

  return (
    <text
      x={x}
      y={y + 14}
      textAnchor="middle"
      fill="var(--texto-fraco)"
      fontSize={11}
      role="button"
      tabIndex={0}
      aria-label={`Ver negócios na etapa ${nome}`}
      style={{ cursor: 'pointer' }}
      onClick={selecionar}
      onKeyDown={(evento) => {
        if (evento.key === 'Enter' || evento.key === ' ') {
          evento.preventDefault();
          selecionar();
        }
      }}
    >
      {linhas.map((linha, indice) => (
        <tspan key={linha} x={x} dy={indice === 0 ? 0 : 14}>
          {linha}
        </tspan>
      ))}
    </text>
  );
}

function quebrarRotulo(nome: string, limite = 14): string[] {
  const palavras = nome.split(' ');
  if (nome.length <= limite || palavras.length === 1) return [nome];

  let melhorCorte = 1;
  let menorDiferenca = Infinity;
  for (let corte = 1; corte < palavras.length; corte++) {
    const primeira = palavras.slice(0, corte).join(' ');
    const segunda = palavras.slice(corte).join(' ');
    const diferenca = Math.abs(primeira.length - segunda.length);
    if (diferenca < menorDiferenca) {
      menorDiferenca = diferenca;
      melhorCorte = corte;
    }
  }
  return [palavras.slice(0, melhorCorte).join(' '), palavras.slice(melhorCorte).join(' ')];
}

function ListaNegocios({ etapa }: { etapa: EtapaFunil }) {
  if (etapa.negocios.length === 0) {
    return <p className="nota">Nenhum negócio aberto nesta etapa.</p>;
  }

  return (
    <table className="tabela">
      <thead>
        <tr>
          <th>#</th>
          <th>Negócio</th>
          <th>Proprietário</th>
        </tr>
      </thead>
      <tbody>
        {etapa.negocios.map((negocio, indice) => (
          <tr key={negocio.negocioId}>
            <td style={{ color: 'var(--texto-fraco)' }}>{indice + 1}</td>
            <td>
              <a href={linkDoNegocio(negocio.negocioId)} target="_blank" rel="noopener noreferrer">
                {negocio.titulo || `Negócio ${negocio.negocioId}`}
              </a>
            </td>
            <td>{negocio.proprietario ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function CardFunilClosers() {
  const estado = useApi<FunilClosersResposta>('/api/funil-closers');
  const [etapaSelecionada, setEtapaSelecionada] = useState<EtapaFunil | null>(null);

  return (
    <>
      <Painel titulo="Negócios por etapa · Salabim" estado={estado}>
        {(dados) => {
          const selecionarPorNome = (nome: string) => {
            const etapa = dados.etapas.find((item) => item.nome === nome);
            if (etapa) setEtapaSelecionada(etapa);
          };

          return (
            <div>
              <div className="funil-closers-total">
                <strong className="medio">{dados.total}</strong>
                <span className="rotulo">negócios abertos no funil</span>
              </div>

              {dados.etapas.length > 0 ? (
                <div
                  role="group"
                  aria-label={`Negócios abertos por etapa no funil Salabim. Total: ${dados.total}.`}
                  style={{ width: '100%', height: 320, marginTop: 12 }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={dados.etapas}
                      margin={{ top: 22, right: 8, left: -12, bottom: 4 }}
                      accessibilityLayer
                    >
                      <CartesianGrid stroke="var(--borda)" vertical={false} />
                      <XAxis
                        dataKey="nome"
                        interval={0}
                        height={44}
                        tick={<TickEtapa aoSelecionar={selecionarPorNome} />}
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
                        cursor="pointer"
                        onClick={(evento: unknown) => {
                          if (!evento || typeof evento !== 'object') return;
                          const dado = evento as { payload?: unknown };
                          const etapa = (dado.payload ?? evento) as EtapaFunil;
                          if (typeof etapa.id === 'number') setEtapaSelecionada(etapa);
                        }}
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
                Clique em uma barra ou no nome da etapa para ver os negócios que a compõem.
              </p>
            </div>
          );
        }}
      </Painel>

      {etapaSelecionada && (
        <Modal
          titulo={etapaSelecionada.nome}
          subtitulo={`${etapaSelecionada.total} ${etapaSelecionada.total === 1 ? 'negócio aberto' : 'negócios abertos'}`}
          aoFechar={() => setEtapaSelecionada(null)}
        >
          <ListaNegocios etapa={etapaSelecionada} />
        </Modal>
      )}
    </>
  );
}
