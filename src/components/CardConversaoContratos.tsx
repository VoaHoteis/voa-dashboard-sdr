'use client';

import { useState } from 'react';
import { Modal, NumeroClicavel, Painel, useApi } from '@/components/base';
import { FUNNEL_LABEL, type FunnelKey } from '@/lib/config';
import { formatarBR } from '@/lib/dates';
import type { ConversaoContratosResposta } from '@/lib/types';

function percentual(valor: number | null): string {
  if (valor === null) return '—';
  return `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;
}

export function CardConversaoContratos({ url = '/api/conversao-contratos' }: { url?: string }) {
  const estado = useApi<ConversaoContratosResposta>(url);
  const [closerSelecionado, setCloserSelecionado] = useState<string | null>(null);
  const detalhe = estado.dados?.porCloser.find((closer) => closer.closer === closerSelecionado);

  return (
    <>
      <Painel
        titulo="Conversão de agendamentos em contratos"
        periodo={
          estado.dados
            ? `Últimos 90 dias · ${formatarBR(estado.dados.periodo.inicio)}–${formatarBR(estado.dados.periodo.fim)}`
            : 'Últimos 90 dias'
        }
        estado={estado}
      >
      {(dados) => (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 12 }}>
            <strong
              style={{ color: 'var(--destaque)', fontSize: 38, fontVariantNumeric: 'tabular-nums' }}
              title="Negócios ganhos nos últimos 90 dias divididos pelas reuniões realizadas nos últimos 90 dias"
            >
              {percentual(dados.taxaConversao)}
            </strong>
            <span className="rotulo">
              {dados.totalContratos} {dados.totalContratos === 1 ? 'contrato assinado' : 'contratos assinados'}
              {' ÷ '}
              {dados.totalAgendamentos} {dados.totalAgendamentos === 1 ? 'agendamento' : 'agendamentos'}
              {' · últimos 90 dias'}
            </span>
          </div>

          <div style={{ display: 'grid', gap: 14, marginTop: 22 }}>
            <span className="rotulo">Por closer</span>
            {dados.porCloser.map((closer) => (
              <div
                key={closer.closer}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(100px, 1fr) auto auto',
                  alignItems: 'baseline',
                  gap: 16,
                }}
              >
                <strong style={{ fontSize: 14 }}>{closer.nome}</strong>
                <span className="rotulo">
                  {closer.contratos} {closer.contratos === 1 ? 'contrato' : 'contratos'} /{' '}
                  {closer.agendamentos} {closer.agendamentos === 1 ? 'agendamento' : 'agendamentos'}
                </span>
                <NumeroClicavel
                  valor={percentual(closer.taxaConversao)}
                  classe="numero forte"
                  cor="var(--destaque)"
                  aoAbrir={() => setCloserSelecionado(closer.closer)}
                  titulo={`Ver os hotéis que compõem a conversão de ${closer.nome}`}
                />
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gap: 14, marginTop: 24 }}>
            <span className="rotulo">Por funil · últimos 90 dias</span>
            {(['salabim', 'novosNegocios'] as FunnelKey[]).map((funil) => {
              const metricas = dados.porFunil[funil];
              return (
                <div
                  key={funil}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(100px, 1fr) auto auto',
                    alignItems: 'baseline',
                    gap: 16,
                  }}
                >
                  <strong style={{ fontSize: 14 }}>{FUNNEL_LABEL[funil]}</strong>
                  <span className="rotulo">
                    {metricas.contratos} {metricas.contratos === 1 ? 'contrato' : 'contratos'} /{' '}
                    {metricas.agendamentos} {metricas.agendamentos === 1 ? 'agendamento' : 'agendamentos'}
                  </span>
                  <span className="numero forte">{percentual(metricas.taxaConversao)}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
      </Painel>

      {detalhe && estado.dados && (
        <Modal
          titulo={`Hotéis na conversão · ${detalhe.nome}`}
          subtitulo={`${detalhe.contratos} ${detalhe.contratos === 1 ? 'contrato' : 'contratos'} ÷ ${detalhe.agendamentos} ${detalhe.agendamentos === 1 ? 'reunião' : 'reuniões'} · últimos 90 dias · ${formatarBR(estado.dados.periodo.inicio)} a ${formatarBR(estado.dados.periodo.fim)}`}
          aoFechar={() => setCloserSelecionado(null)}
        >
          {detalhe.hoteis.length === 0 ? (
            <p className="nota" style={{ border: 'none', marginTop: 0 }}>
              Nenhum hotel compõe a conta deste closer no período.
            </p>
          ) : (
            <table className="tabela">
              <thead>
                <tr>
                  <th>Hotel</th>
                  <th>Origem do lead</th>
                  <th className="num">Reuniões</th>
                  <th className="num">Contratos</th>
                </tr>
              </thead>
              <tbody>
                {detalhe.hoteis.map((hotel) => (
                  <tr key={hotel.hotel}>
                    <td>{hotel.hotel}</td>
                    <td>{hotel.origens.length ? hotel.origens.join(', ') : '—'}</td>
                    <td className="num">{hotel.agendamentos}</td>
                    <td className="num">{hotel.contratos}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th>Total</th>
                  <th></th>
                  <th className="num">{detalhe.agendamentos}</th>
                  <th className="num">{detalhe.contratos}</th>
                </tr>
              </tfoot>
            </table>
          )}
        </Modal>
      )}
    </>
  );
}
