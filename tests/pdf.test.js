import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';
import PDFDocument from 'pdfkit';
import { ajustarTamanhoFonte, NOME_TAMANHO_MAX, NOME_TAMANHO_MIN } from '../src/certificado.js';
import { montarCertificados, escreverPdf, gerarPdfUnico, gerarPdfsIndividuais, gravarManifesto } from '../src/gerador.js';
import { lerData } from '../src/texto.js';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'certificados-pdf-'));
after(() => fs.rmSync(dir, { recursive: true, force: true }));

const evento = { evento: 'Semana de Tecnologia', data: lerData('2026-11-05'), cargaHoraria: 8, local: 'São Paulo' };
const participantes = [
  { nome: 'Ana Souza', email: null, cargaHoraria: null },
  { nome: 'Bruno Carvalho', email: 'b@x.com', cargaHoraria: 12 },
  { nome: 'Maria Eduarda Albuquerque de Vasconcelos Cavalcanti Pernambucano Sobrinho Neta', email: null, cargaHoraria: null },
];

const contarPaginas = (buf) => (buf.toString('latin1').match(/\/Type \/Page(?!s)/g) ?? []).length;

/** Coleta a saída do PDF em memória. */
function coletor() {
  const partes = [];
  const stream = new Writable({ write(chunk, _enc, cb) { partes.push(chunk); cb(); } });
  return { stream, buffer: () => Buffer.concat(partes) };
}

test('ajustarTamanhoFonte reduz nomes longos e respeita os limites', () => {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape' });
  const medir = (t) => () => doc.font('Helvetica-Bold').fontSize(1).widthOfString(t);
  const largura = 640;

  assert.equal(ajustarTamanhoFonte(medir('Ana'), largura), NOME_TAMANHO_MAX);
  const longo = participantes[2].nome;
  const t = ajustarTamanhoFonte(medir(longo), largura);
  assert.ok(t < NOME_TAMANHO_MAX && t >= NOME_TAMANHO_MIN);
  assert.ok(doc.font('Helvetica-Bold').fontSize(t).widthOfString(longo) <= largura, 'o nome cabe na largura');
  assert.equal(ajustarTamanhoFonte(medir(longo.repeat(5)), largura), NOME_TAMANHO_MIN);
});

test('montarCertificados aplica carga padrão e exige carga horária', () => {
  const certs = montarCertificados(participantes, evento);
  assert.deepEqual(certs.map((c) => c.cargaHoraria), [8, 12, 8]);
  assert.match(certs[0].arquivo, /^certificado-ana-souza-[0-9A-F-]{14}\.pdf$/);
  assert.throws(() => montarCertificados(participantes, { ...evento, cargaHoraria: undefined }), /carga horária não informada/);
});

test('PDF único: começa com %PDF- e tem uma página por participante', async () => {
  const { stream, buffer } = coletor();
  await escreverPdf(montarCertificados(participantes, evento), stream);
  const buf = buffer();
  assert.equal(buf.subarray(0, 5).toString(), '%PDF-');
  assert.equal(contarPaginas(buf), 3);
});

test('gera arquivos em disco: único e individuais (1 página cada) + manifesto', async () => {
  const certs = montarCertificados(participantes, evento);

  const unico = await gerarPdfUnico(certs, path.join(dir, 'unico', 'certificados.pdf'));
  assert.equal(contarPaginas(fs.readFileSync(unico)), 3);

  const arquivos = await gerarPdfsIndividuais(certs, path.join(dir, 'individuais'), { concorrencia: 2 });
  assert.equal(arquivos.length, 3);
  for (const [i, arq] of arquivos.entries()) {
    assert.equal(path.basename(arq), certs[i].arquivo, 'ordem preservada');
    const buf = fs.readFileSync(arq);
    assert.equal(buf.subarray(0, 5).toString(), '%PDF-');
    assert.equal(contarPaginas(buf), 1);
  }

  const manifesto = gravarManifesto(certs, path.join(dir, 'manifesto.json'), { pdfUnico: 'certificados.pdf' });
  const registros = JSON.parse(fs.readFileSync(manifesto, 'utf8'));
  assert.deepEqual(registros.map((r) => r.pagina), [1, 2, 3]);
  assert.equal(registros[1].codigo, certs[1].codigo);
});

test('lista vazia é recusada', async () => {
  await assert.rejects(escreverPdf([], coletor().stream), /nenhum certificado/);
});
