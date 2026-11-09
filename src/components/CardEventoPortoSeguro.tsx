'use client';

import { Painel, numeroBR, useApi } from '@/components/base';
import type { MetricasEventoPortoSeguroResposta } from '@/lib/types';

const numeroInteiroBR = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

export function CardEventoPortoSeguro() {
  const estado = useApi<MetricasEventoPortoSeguroResposta>('/api/evento-porto-seguro');

  return (
    <Painel titulo="Evento Porto Seguro" estado={estado}>
      {(dados) => (
        <div className="evento-metricas" aria-label="Métricas da etiqueta Evento Porto Seguro">
          <div className="evento-metrica">
            <strong className="numero grande" aria-label={`${numeroInteiroBR.format(dados.leads)} leads`}>
              {numeroBR(dados.leads, 0)}
            </strong>
            <span>Leads com a etiqueta</span>
          </div>
          <div className="evento-metrica">
            <strong
              className="numero grande"
              aria-label={`${numeroInteiroBR.format(dados.negociosAbertos)} negócios abertos`}
            >
              {numeroBR(dados.negociosAbertos, 0)}
            </strong>
            <span>Negócios em aberto com a etiqueta</span>
          </div>
        </div>
      )}
    </Painel>
  );
}
