import { NextResponse } from 'next/server';
import {
  parseQueueActionInput,
  parseQueueOrderInput,
  QueueConflictError,
  QueueInputError,
} from '@/lib/fila-atendimento-core';
import { getQueueSnapshot, queueService } from '@/lib/fila-atendimento-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await getQueueSnapshot(), {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch {
    return NextResponse.json(
      { erro: 'Não foi possível carregar a fila agora. Tente atualizar novamente.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return originError();

  try {
    const input = parseQueueActionInput(await readJson(request));
    const result = await queueService.registerAction(input);
    return NextResponse.json(result, {
      status: 201,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return queueError(error, 'Não foi possível registrar a ação. Ela não foi salva.');
  }
}

export async function PUT(request: Request) {
  if (!sameOrigin(request)) return originError();

  try {
    const input = parseQueueOrderInput(await readJson(request));
    const result = await queueService.saveQueue(input);
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return queueError(error, 'Não foi possível salvar a composição da fila. Nenhuma alteração foi salva.');
  }
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new QueueInputError('O corpo da solicitação não é um JSON válido.');
  }
}

function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);
    const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0].trim();
    const host = forwardedHost || request.headers.get('host') || requestUrl.host;
    const forwardedProtocol = request.headers.get('x-forwarded-proto')?.split(',')[0].trim();
    const protocol = forwardedProtocol ? `${forwardedProtocol.replace(/:$/, '')}:` : requestUrl.protocol;
    return originUrl.host.toLowerCase() === host.toLowerCase() && originUrl.protocol === protocol;
  } catch {
    return false;
  }
}

function originError() {
  return NextResponse.json({ erro: 'Origem da solicitação inválida.' }, { status: 403 });
}

function queueError(error: unknown, fallback: string) {
  if (error instanceof QueueInputError) {
    return NextResponse.json({ erro: error.message }, { status: 400 });
  }
  if (error instanceof QueueConflictError) {
    return NextResponse.json({ erro: error.message }, { status: 409 });
  }
  return NextResponse.json({ erro: fallback }, { status: 503 });
}
