'use client';

import { useState } from 'react';
import { Modal, NumeroClicavel, Painel, useApi } from '@/components/base';
import { formatarBR } from '@/lib/dates';
import type { ConversaoContratosResposta } from '@/lib/types';

function percentual(valor: number | null): string {
  if (valor === null) return '—';
  return `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;
}

export function CardConversaoContratos() {
  const estado = useApi<ConversaoContratosResposta>('/api/conversao-contratos');
  const [closerSelecionado, setCloserSelecionado] = useState<string | null>(null);
  const detalhe = estado.dados?.porCloser.find((closer) => closer.closer === closerSelecionado);

  return (
    <>
      <Painel
        titulo="Conversão de agendamentos em contratos"
        periodo={
          estado.dados
            ? `2 meses anteriores + mês atual · ${formatarBR(estado.dados.periodo.inicio)}–${formatarBR(estado.dados.periodo.fim)}`
            : 'Últimos 3 meses'
        }
        estado={estado}
      >
      {(dados) => (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 12 }}>
            <strong
              style={{ color: 'var(--destaque)', fontSize: 38, fontVariantNumeric: 'tabular-nums' }}
              title="Contratos ganhos divididos por todas as reuniões concluídas nos últimos três meses"
            >
              {percentual(dados.taxaConversao)}
            </strong>
            <span className="rotulo">
              {dados.totalContratos} {dados.totalContratos === 1 ? 'contrato assinado' : 'contratos assinados'}
              {' ÷ '}
              {dados.totalAgendamentos} {dados.totalAgendamentos === 1 ? 'agendamento' : 'agendamentos'}
              {' · '}
              {formatarBR(dados.periodo.inicio)}–{formatarBR(dados.periodo.fim)}
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

          <p className="nota perdas-nota">
            Taxa calculada como contratos assinados (negócios ganhos) ÷ reuniões concluídas nos dois meses
            anteriores e no mês atual até hoje. Contamos reuniões de todos os usuários, desde que vinculadas
            a negócios dos funis acompanhados; o detalhamento é atribuído pelo proprietário do negócio.
            Como não é uma coorte de oportunidades, a taxa pode ultrapassar 100%.
          </p>
        </>
      )}
      </Painel>

      {detalhe && estado.dados && (
        <Modal
          titulo={`Hotéis na conversão · ${detalhe.nome}`}
          subtitulo={`${detalhe.contratos} ${detalhe.contratos === 1 ? 'contrato' : 'contratos'} ÷ ${detalhe.agendamentos} ${detalhe.agendamentos === 1 ? 'reunião' : 'reuniões'} · ${formatarBR(estado.dados.periodo.inicio)} a ${formatarBR(estado.dados.periodo.fim)}`}
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
                  <th className="num">Reuniões</th>
                  <th className="num">Contratos</th>
                </tr>
              </thead>
              <tbody>
                {detalhe.hoteis.map((hotel) => (
                  <tr key={hotel.hotel}>
                    <td>{hotel.hotel}</td>
                    <td className="num">{hotel.agendamentos}</td>
                    <td className="num">{hotel.contratos}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th>Total</th>
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
