// Funções puras de texto: datas por extenso, código de verificação e nomes de arquivo.
import { createHash, createHmac } from 'node:crypto';

const FORMATO_EXTENSO = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
});

/** Ex.: 2026-11-05 → "5 de novembro de 2026". */
export function dataPorExtenso(data) {
  return FORMATO_EXTENSO.format(data);
}

/** Aceita "AAAA-MM-DD", "DD/MM/AAAA" ou Date; devolve Date em UTC (meia-noite). */
export function lerData(valor) {
  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) throw new Error('data inválida');
    return new Date(Date.UTC(valor.getUTCFullYear(), valor.getUTCMonth(), valor.getUTCDate()));
  }
  const s = String(valor ?? '').trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  let partes = m ? [+m[1], +m[2], +m[3]] : null;
  if (!partes && (m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s))) partes = [+m[3], +m[2], +m[1]];
  if (!partes) throw new Error(`data inválida: "${s}" (use AAAA-MM-DD ou DD/MM/AAAA)`);
  const [a, mes, d] = partes;
  const data = new Date(Date.UTC(a, mes - 1, d));
  if (data.getUTCFullYear() !== a || data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== d) {
    throw new Error(`data inválida: "${s}"`);
  }
  return data;
}

/**
 * Código curto derivado de SHA-256 dos dados do certificado (12 hex, ex.: "3F9A-01C2-7B44").
 * Com `segredo`, usa HMAC-SHA256: só quem tem a chave consegue gerar códigos válidos.
 */
export function codigoVerificacao({ nome, evento, data, cargaHoraria }, segredo) {
  const conteudo = JSON.stringify([nome, evento, data.toISOString().slice(0, 10), cargaHoraria]);
  const h = segredo ? createHmac('sha256', segredo) : createHash('sha256');
  const hex = h.update(conteudo, 'utf8').digest('hex').slice(0, 12).toUpperCase();
  return hex.match(/.{4}/g).join('-');
}

/** Nome de arquivo seguro: sem acentos, sem separadores de caminho, em minúsculas. */
export function nomeArquivo(nome, codigo) {
  const slug = String(nome)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'participante';
  return `certificado-${slug}-${codigo}.pdf`;
}

/** "8" → "8 horas", "1" → "1 hora", 1.5 → "1,5 hora". */
export function formatarHoras(horas) {
  const n = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(horas);
  return `${n} ${horas >= 2 ? 'horas' : 'hora'}`;
}
