import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import './globals.css';

const numero = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--fonte-numero',
  display: 'swap',
});

const texto = Inter({
  subsets: ['latin'],
  variable: '--fonte-texto',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Painel Comercial — VOA Hotéis',
  description: 'Acompanhamento de agendamentos, desempenho e metas do time comercial a partir do Pipedrive.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${numero.variable} ${texto.variable}`}>
      <body>{children}</body>
    </html>
  );
}
