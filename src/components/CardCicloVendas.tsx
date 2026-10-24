'use client';

import { useState } from 'react';
import { Modal, NumeroClicavel, Painel, useApi } from '@/components/base';
import { formatarBR } from '@/lib/dates';
import type { CicloVendasResposta } from '@/lib/types';

function dias(valor: number | null): string {
  if (valor === null) return '—';
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
}

export function CardCicloVendas({ url = '/api/ciclo-vendas' }: { url?: string }) {
  const estado = useApi<CicloVendasResposta>(url);
  const [detalheAberto, setDetalheAberto] = useState(false);
  const dados = estado.dados;

  return (
    <>
      <Painel
        titulo="Ciclo de vendas"
        periodo={
          dados
            ? `Contratos assinados · ${formatarBR(dados.periodo.inicio)}–${formatarBR(dados.periodo.fim)}`
            : 'Período selecionado'
        }
        estado={estado}
      >
        {(resposta) => (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 16,
              }}
            >
              <div>
                <strong
                  style={{ color: 'var(--destaque)', fontSize: 34, fontVariantNumeric: 'tabular-nums' }}
                  title="Média de dias corridos entre a primeira apresentação e a assinatura do contrato"
                >
                  {dias(resposta.diasMediosDesdePrimeira)} dias
                </strong>
                <p className="rotulo">Desde a primeira apresentação</p>
              </div>
              <div>
                <strong
                  style={{ color: 'var(--destaque)', fontSize: 34, fontVariantNumeric: 'tabular-nums' }}
                  title="Média de dias corridos entre a apresentação mais recente antes da assinatura e o contrato"
                >
                  {dias(resposta.diasMediosDesdeUltima)} dias
                </strong>
                <p className="rotulo">Desde a apresentação mais recente</p>
              </div>
            </div>

            <p className="rotulo" style={{ marginTop: 14 }}>
              {resposta.contratosComAgendamento} de {resposta.totalContratos}{' '}
              {resposta.totalContratos === 1 ? 'contrato' : 'contratos'} com apresentação encontrada
            </p>

            <div style={{ marginTop: 18 }}>
              <NumeroClicavel
                valor={`Ver ${resposta.contratosComAgendamento} negócios usados no cálculo`}
                classe="numero forte"
                cor="var(--novos)"
                aoAbrir={() => setDetalheAberto(true)}
                titulo="Ver primeira e última apresentação, assinatura e duração de cada ciclo"
                desabilitado={resposta.itens.length === 0}
              />
            </div>

            <p className="nota perdas-nota">
              A primeira média vai da apresentação mais antiga à assinatura; a segunda, da apresentação
              mais recente registrada até a assinatura. Apresentações posteriores ao fechamento são ignoradas.
              Contratos sem apresentação vinculada ficam fora das médias.
              {resposta.semAgendamento > 0 && ` ${resposta.semAgendamento} contrato(s) sem apresentação válida.`}
            </p>
          </>
        )}
      </Painel>

      {detalheAberto && dados && (
        <Modal
          titulo="Ciclo por negócio"
          subtitulo={`${dados.contratosComAgendamento} negócios · primeira apresentação: ${dias(dados.diasMediosDesdePrimeira)} dias · apresentação mais recente: ${dias(dados.diasMediosDesdeUltima)} dias · ${formatarBR(dados.periodo.inicio)} a ${formatarBR(dados.periodo.fim)}`}
          aoFechar={() => setDetalheAberto(false)}
        >
          <table className="tabela">
            <thead>
              <tr>
                <th>Negócio</th>
                <th>1ª apresentação</th>
                <th>Última apresentação</th>
                <th>Assinatura</th>
                <th className="num">Dias desde 1ª</th>
                <th className="num">Dias desde última</th>
              </tr>
            </thead>
            <tbody>
              {dados.itens.map((item) => (
                <tr key={item.negocioId}>
                  <td>{item.hotel}</td>
                  <td>{formatarBR(item.primeiroAgendamento)}</td>
                  <td>{formatarBR(item.ultimoAgendamento)}</td>
                  <td>{formatarBR(item.assinatura)}</td>
                  <td className="num">{item.diasDesdePrimeira}</td>
                  <td className="num">{item.diasDesdeUltima}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}
    </>
  );
}
