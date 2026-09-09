/**
 * Sessão do acesso por senha.
 *
 * O cookie carrega só a validade e uma assinatura HMAC dela. Sem a assinatura,
 * qualquer pessoa criaria o cookie na mão no console do navegador e entraria --
 * o cookie precisa ser inforjável, não secreto.
 *
 * Usa Web Crypto (`crypto.subtle`), que existe tanto no runtime Edge do
 * middleware quanto no Node das rotas. `node:crypto` não serve: não roda no Edge.
 */

export const COOKIE_SESSAO = 'voa_sdr';

const DIAS = 30;
const VALIDADE_MS = DIAS * 24 * 60 * 60 * 1000;

/**
 * O segredo da assinatura sai da própria senha quando não há um separado.
 * Efeito colateral desejado: trocar a senha invalida as sessões abertas.
 */
function segredo(): string {
  return process.env.DASHBOARD_SEGREDO || process.env.DASHBOARD_SENHA || '';
}

function base64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function assinar(dados: string): Promise<string> {
  const chave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(segredo()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return base64url(await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(dados)));
}

/** Comparação de tempo constante: sair no primeiro byte diferente vaza informação. */
function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

export async function criarToken(): Promise<string> {
  const validade = String(Date.now() + VALIDADE_MS);
  return `${validade}.${await assinar(validade)}`;
}

export async function tokenValido(token: string | undefined): Promise<boolean> {
  if (!token || !segredo()) return false;
  const [validade, assinatura] = token.split('.');
  if (!validade || !assinatura) return false;
  if (!Number(validade) || Number(validade) < Date.now()) return false;
  return iguais(assinatura, await assinar(validade));
}

/**
 * Confere a senha digitada comparando as ASSINATURAS, não os textos: assim a
 * comparação tem sempre o mesmo tamanho e não vaza o comprimento da senha.
 */
export async function senhaConfere(digitada: string): Promise<boolean> {
  const correta = process.env.DASHBOARD_SENHA;
  if (!correta) return false;
  return iguais(await assinar('s:' + digitada), await assinar('s:' + correta));
}

export function opcoesCookie(producao: boolean) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: producao,
    path: '/',
    maxAge: DIAS * 24 * 60 * 60,
  };
}
