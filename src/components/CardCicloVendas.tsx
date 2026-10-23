'use client';

import { useState } from 'react';
import { Modal, NumeroClicavel, Painel, useApi } from '@/components/base';
import { formatarBR } from '@/lib/dates';
import type { CicloVendasResposta } from '@/lib/types';

function dias(valor: number | null): string {
  if (valor === null) return '—';
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
}

export function CardCicloVendas() {
  const estado = useApi<CicloVendasResposta>('/api/ciclo-vendas');
  const [detalheAberto, setDetalheAberto] = useState(false);
  const dados = estado.dados;

  return (
    <>
      <Painel
        titulo="Ciclo de vendas"
        periodo={
          dados
            ? `Contratos assinados · ${formatarBR(dados.periodo.inicio)}–${formatarBR(dados.periodo.fim)}`
            : 'Mês atual + 2 anteriores'
        }
        estado={estado}
      >
        {(resposta) => (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 12 }}>
              <strong
                style={{ color: 'var(--destaque)', fontSize: 38, fontVariantNumeric: 'tabular-nums' }}
                title="Média de dias corridos entre o primeiro agendamento vinculado e a assinatura do contrato"
              >
                {dias(resposta.diasMedios)} dias
              </strong>
              <span className="rotulo">
                média até a assinatura · {resposta.contratosComAgendamento} de {resposta.totalContratos}{' '}
                {resposta.totalContratos === 1 ? 'contrato' : 'contratos'} com agendamento encontrado
              </span>
            </div>

            <div style={{ marginTop: 18 }}>
              <NumeroClicavel
                valor={`Ver ${resposta.contratosComAgendamento} negócios usados no cálculo`}
                classe="numero forte"
                cor="var(--novos)"
                aoAbrir={() => setDetalheAberto(true)}
                titulo="Ver datas de agendamento, assinatura e duração de cada ciclo"
                desabilitado={resposta.itens.length === 0}
              />
            </div>

            <p className="nota perdas-nota">
              A média considera dias corridos entre a primeira atividade de agendamento ligada ao negócio
              e a data de assinatura. Contratos sem agendamento anterior à assinatura ficam fora da média.
              {resposta.semAgendamento > 0 && ` ${resposta.semAgendamento} contrato(s) sem data válida.`}
            </p>
          </>
        )}
      </Painel>

      {detalheAberto && dados && (
        <Modal
          titulo="Ciclo por negócio"
          subtitulo={`${dados.contratosComAgendamento} ciclos · média de ${dias(dados.diasMedios)} dias · ${formatarBR(dados.periodo.inicio)} a ${formatarBR(dados.periodo.fim)}`}
          aoFechar={() => setDetalheAberto(false)}
        >
          <table className="tabela">
            <thead>
              <tr>
                <th>Negócio</th>
                <th>Agendamento</th>
                <th>Assinatura</th>
                <th className="num">Dias</th>
              </tr>
            </thead>
            <tbody>
              {dados.itens.map((item) => (
                <tr key={item.negocioId}>
                  <td>{item.hotel}</td>
                  <td>{formatarBR(item.agendamento)}</td>
                  <td>{formatarBR(item.assinatura)}</td>
                  <td className="num">{item.dias}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}
    </>
  );
}
