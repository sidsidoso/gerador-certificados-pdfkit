import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dataPorExtenso, lerData, codigoVerificacao, nomeArquivo, formatarHoras } from '../src/texto.js';

test('dataPorExtenso usa Intl pt-BR sem deslocamento de fuso', () => {
  assert.equal(dataPorExtenso(lerData('2026-11-05')), '5 de novembro de 2026');
  assert.equal(dataPorExtenso(lerData('01/03/2025')), '1 de março de 2025');
  assert.equal(dataPorExtenso(lerData('31/12/2024')), '31 de dezembro de 2024');
});

test('lerData aceita ISO e DD/MM/AAAA e recusa datas inexistentes', () => {
  assert.equal(lerData('2026-02-28').toISOString(), '2026-02-28T00:00:00.000Z');
  assert.equal(lerData('5/11/2026').toISOString(), '2026-11-05T00:00:00.000Z');
  assert.throws(() => lerData('30/02/2026'), /data inválida/);
  assert.throws(() => lerData('amanhã'), /data inválida/);
});

test('codigoVerificacao é determinístico, curto e sensível aos dados', () => {
  const dados = { nome: 'Ana', evento: 'Semana', data: lerData('2026-11-05'), cargaHoraria: 8 };
  const codigo = codigoVerificacao(dados);
  assert.match(codigo, /^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
  assert.equal(codigoVerificacao({ ...dados }), codigo);
  assert.notEqual(codigoVerificacao({ ...dados, nome: 'Ana ' }), codigo);
  assert.notEqual(codigoVerificacao({ ...dados, cargaHoraria: 9 }), codigo);
  assert.notEqual(codigoVerificacao(dados, 'chave-secreta'), codigo, 'HMAC difere do hash simples');
});

test('nomeArquivo remove acentos e separadores de caminho', () => {
  assert.equal(nomeArquivo('João da Silva', 'AAAA-BBBB-CCCC'), 'certificado-joao-da-silva-AAAA-BBBB-CCCC.pdf');
  assert.equal(nomeArquivo('../../etc/passwd', 'X'), 'certificado-etc-passwd-X.pdf');
  assert.equal(nomeArquivo('***', 'X'), 'certificado-participante-X.pdf');
});

test('formatarHoras usa singular/plural e vírgula decimal', () => {
  assert.equal(formatarHoras(8), '8 horas');
  assert.equal(formatarHoras(1), '1 hora');
  assert.equal(formatarHoras(4.5), '4,5 horas');
});
