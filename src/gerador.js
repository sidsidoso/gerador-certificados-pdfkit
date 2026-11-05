// Geração dos PDFs: um arquivo por participante ou um único arquivo com várias páginas.
import * as fs from 'node:fs';
import path from 'node:path';
import { finished } from 'node:stream/promises';
import PDFDocument from 'pdfkit';
import { desenharCertificado } from './certificado.js';
import { codigoVerificacao, nomeArquivo } from './texto.js';

/**
 * Junta participantes e dados do evento, calculando código de verificação e nome de arquivo.
 * evento: { evento, data, cargaHoraria?, instituicao?, local?, responsavel?, cargo? }
 */
export function montarCertificados(participantes, evento, segredo) {
  return participantes.map((p) => {
    const cargaHoraria = p.cargaHoraria ?? evento.cargaHoraria;
    if (!(cargaHoraria > 0)) throw new Error(`carga horária não informada para "${p.nome}" (use --carga)`);
    const dados = { ...evento, nome: p.nome, email: p.email ?? null, cargaHoraria };
    const codigo = codigoVerificacao(dados, segredo);
    return { ...dados, codigo, arquivo: nomeArquivo(p.nome, codigo) };
  });
}

function criarDocumento(titulo) {
  return new PDFDocument({
    size: 'A4', layout: 'landscape', margin: 0, autoFirstPage: false,
    info: { Title: titulo, Subject: 'Certificado de participação', Creator: 'gerador-certificados-pdfkit' },
  });
}

/** Escreve os certificados (uma página cada) no stream e aguarda o término da escrita. */
export async function escreverPdf(certificados, saida) {
  if (certificados.length === 0) throw new Error('nenhum certificado para gerar');
  const titulo = certificados.length === 1 ? `Certificado - ${certificados[0].nome}` : `Certificados - ${certificados[0].evento}`;
  const doc = criarDocumento(titulo);
  doc.pipe(saida);
  for (const c of certificados) {
    doc.addPage();
    desenharCertificado(doc, c);
  }
  doc.end();
  await finished(saida);
}

/** Um único PDF com uma página por participante. */
export async function gerarPdfUnico(certificados, arquivo) {
  fs.mkdirSync(path.dirname(path.resolve(arquivo)), { recursive: true });
  await escreverPdf(certificados, fs.createWriteStream(arquivo));
  return arquivo;
}

/** Um PDF por participante, gerados com concorrência limitada. */
export async function gerarPdfsIndividuais(certificados, pasta, { concorrencia = 4 } = {}) {
  fs.mkdirSync(pasta, { recursive: true });
  const arquivos = new Array(certificados.length);
  let proximo = 0;
  const trabalhador = async () => {
    while (proximo < certificados.length) {
      const i = proximo++;
      const destino = path.join(pasta, certificados[i].arquivo);
      await escreverPdf([certificados[i]], fs.createWriteStream(destino));
      arquivos[i] = destino;
    }
  };
  await Promise.all(Array.from({ length: Math.min(concorrencia, certificados.length) }, trabalhador));
  return arquivos;
}

/** Manifesto com os códigos emitidos, para conferência posterior. */
export function gravarManifesto(certificados, arquivo, { pdfUnico } = {}) {
  const registros = certificados.map(({ nome, email, evento, cargaHoraria, data, codigo, arquivo: pdf }, i) => ({
    nome, email, evento, cargaHoraria, data: data.toISOString().slice(0, 10), codigo,
    ...(pdfUnico ? { arquivo: pdfUnico, pagina: i + 1 } : { arquivo: pdf }),
  }));
  fs.writeFileSync(arquivo, JSON.stringify(registros, null, 2) + '\n');
  return arquivo;
}
