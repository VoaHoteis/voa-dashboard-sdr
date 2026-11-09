import type { Metadata } from 'next';
import FilaAtendimento from '@/components/fila-atendimento/FilaAtendimento';

export const metadata: Metadata = {
  title: 'Fila de Atendimento — VOA Hotéis',
  description: 'Distribuição e histórico dos atendimentos do time Comercial/SDR da VOA Hotéis.',
};

export default function FilaAtendimentoPage() {
  return <FilaAtendimento />;
}
