import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { interpretarLinhas, lerParticipantes } from '../src/participantes.js';
import { gerarPlanilhaExemplo } from '../scripts/gerar-exemplo.js';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'certificados-'));
after(() => fs.rmSync(dir, { recursive: true, force: true }));

test('lê a planilha de exemplo e separa válidos de rejeitados', () => {
  const arquivo = gerarPlanilhaExemplo(path.join(dir, 'participantes.xlsx'));
  const { participantes, rejeitados } = lerParticipantes(arquivo);

  assert.deepEqual(participantes.map((p) => p.nome), [
    'Ana Beatriz Souza',
    'Bruno Carvalho',
    'Maria Eduarda Albuquerque de Vasconcelos Cavalcanti Pernambucano Sobrinho',
    'João Pedro Nogueira',
  ]);
  assert.equal(participantes[0].cargaHoraria, null);
  assert.equal(participantes[1].cargaHoraria, 12);
  assert.equal(participantes[3].cargaHoraria, 4.5, 'aceita vírgula decimal');
  assert.deepEqual(rejeitados, [
    { linha: 6, motivo: 'nome ausente' },
    { linha: 7, motivo: 'participante duplicado' },
    { linha: 8, motivo: 'carga horária inválida: "-3"' },
  ]);
});

test('aceita CSV e cabeçalhos com variações', () => {
  const arquivo = path.join(dir, 'lista.csv');
  fs.writeFileSync(arquivo, '﻿PARTICIPANTE;E-MAIL\nLúcia Ávila;LUCIA@EXEMPLO.COM\n'.replaceAll(';', ','));
  const { participantes } = lerParticipantes(arquivo);
  assert.deepEqual(participantes, [{ linha: 2, nome: 'Lúcia Ávila', email: 'lucia@exemplo.com', cargaHoraria: null }]);
});

test('exige a coluna Nome e extensão suportada', () => {
  assert.throws(() => interpretarLinhas([['Email'], ['a@b.com']]), /coluna "Nome" não encontrada/);
  assert.throws(() => lerParticipantes(path.join(dir, 'x.pdf')), /extensão não suportada/);
});
