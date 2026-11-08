'use client';

import type { NegociosMercadoResposta } from '@/lib/types';
import { GraficoPizzaBI } from './GraficoPizzaBI';
import { Painel, useApi, type Estado } from './base';

type CampoDistribuicao = 'channelManager' | 'pms';

function CardDistribuicaoNegocios({
  estado,
  campo,
  titulo,
}: {
  estado: Estado<NegociosMercadoResposta>;
  campo: CampoDistribuicao;
  titulo: string;
}) {
  return (
    <Painel titulo={titulo} estado={estado}>
      {(dados) => (
        <GraficoPizzaBI
          campo={campo === 'channelManager' ? 'CHANNEL' : 'PMS'}
          dados={dados[campo]}
        />
      )}
    </Painel>
  );
}

export function CardsNegociosMercadoBI() {
  const estado = useApi<NegociosMercadoResposta>('/api/negocios-mercado');

  return (
    <>
      <CardDistribuicaoNegocios
        estado={estado}
        campo="channelManager"
        titulo="Negócios por Channel Manager"
      />
      <CardDistribuicaoNegocios estado={estado} campo="pms" titulo="Negócios por PMS" />
    </>
  );
}
