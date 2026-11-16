'use client';

import { Painel, useApi } from '@/components/base';
import { formatarBR } from '@/lib/dates';
import type { AgendamentosClosersResposta } from '@/lib/types';

export function CardAgendamentosClosers({ url }: { url: string }) {
  const estado = useApi<AgendamentosClosersResposta>(url);
  const periodo = estado.dados
    ? `${formatarBR(estado.dados.periodo.inicio)}–${formatarBR(estado.dados.periodo.fim)}`
    : 'Período selecionado';

  return (
    <Painel titulo="Agendamentos realizados por closer" periodo={periodo} estado={estado}>
      {(dados) => (
        <>
          <div className="funil-closers-total">
            <strong className="medio">{dados.total}</strong>
            <span className="rotulo">reuniões realizadas no período</span>
          </div>
          <table className="tabela" aria-label="Agendamentos realizados por closer">
            <thead>
              <tr>
                <th>Closer</th>
                <th className="num">Agendamentos</th>
              </tr>
            </thead>
            <tbody>
              {dados.porCloser.map((closer) => (
                <tr key={closer.closer}>
                  <td>{closer.nome}</td>
                  <td className="num">{closer.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="nota">
            Reuniões de Apresentação e Reunião de Apresentação Prospecção Executivo concluídas
            no período, atribuídas pelo proprietário do negócio. Inclui negócios abertos e perdidos.
          </p>
        </>
      )}
    </Painel>
  );
}
