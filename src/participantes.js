// Leitura da lista de participantes com SheetJS (.xlsx/.xls/.csv).
import * as fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';

XLSX.set_fs(fs);

export const TAMANHO_MAXIMO = 5 * 1024 * 1024; // 5 MB
export const MAX_PARTICIPANTES = 5000;
const NOME_MAX = 120;

const COLUNAS = {
  nome: ['nome', 'participante', 'nome completo'],
  email: ['email', 'e-mail'],
  cargaHoraria: ['carga horaria', 'carga', 'horas'],
};

const chave = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[\s_]+/g, ' ').trim();

/** Interpreta a matriz (1ª linha = cabeçalho) e valida cada participante. Função pura. */
export function interpretarLinhas(matriz) {
  const [cab = [], ...linhas] = matriz;
  const indices = {};
  for (const [campo, apelidos] of Object.entries(COLUNAS)) {
    const i = cab.findIndex((c) => apelidos.includes(chave(c)));
    if (i >= 0) indices[campo] = i;
  }
  if (indices.nome === undefined) throw new Error('coluna "Nome" não encontrada na planilha');

  const participantes = [];
  const rejeitados = [];
  const vistos = new Set();
  linhas.forEach((valores, i) => {
    const linha = i + 2;
    if (valores.every((v) => v === null || String(v).trim() === '')) return;
    const nome = String(valores[indices.nome] ?? '').replace(/\s+/g, ' ').trim();
    const email = indices.email !== undefined ? String(valores[indices.email] ?? '').trim().toLowerCase() || null : null;
    const bruta = indices.cargaHoraria !== undefined ? valores[indices.cargaHoraria] : null;
    const cargaHoraria = bruta === null || bruta === '' ? null : Number(String(bruta).replace(',', '.'));

    let motivo = null;
    if (!nome) motivo = 'nome ausente';
    else if (nome.length > NOME_MAX) motivo = `nome com mais de ${NOME_MAX} caracteres`;
    else if (cargaHoraria !== null && !(cargaHoraria > 0 && cargaHoraria <= 1000)) motivo = `carga horária inválida: "${bruta}"`;
    else if (vistos.has(chave(nome))) motivo = 'participante duplicado';
    if (motivo) { rejeitados.push({ linha, motivo }); return; }

    vistos.add(chave(nome));
    participantes.push({ linha, nome, email, cargaHoraria });
  });
  if (participantes.length > MAX_PARTICIPANTES) throw new Error(`limite de ${MAX_PARTICIPANTES} participantes excedido`);
  return { participantes, rejeitados };
}

/** Lê a planilha do disco e devolve { participantes, rejeitados }. */
export function lerParticipantes(caminho, { aba } = {}) {
  const ext = path.extname(caminho).toLowerCase();
  if (!['.xlsx', '.xls', '.csv'].includes(ext)) throw new Error(`extensão não suportada: "${ext}"`);
  if (fs.statSync(caminho).size > TAMANHO_MAXIMO) throw new Error('planilha maior que 5 MB');
  const wb = ext === '.csv'
    ? XLSX.read(fs.readFileSync(caminho, 'utf8').replace(/^﻿/, ''), { type: 'string', raw: true })
    : XLSX.readFile(caminho, { cellFormula: false, cellHTML: false });
  const ws = wb.Sheets[aba ?? wb.SheetNames[0]];
  if (!ws) throw new Error(`aba "${aba}" não encontrada (abas: ${wb.SheetNames.join(', ')})`);
  return interpretarLinhas(XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true }));
}
