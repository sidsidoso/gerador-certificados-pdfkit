// Gera saidas/participantes.xlsx com participantes fictícios (inclui casos inválidos).
// Uso: npm run exemplo
import * as fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as XLSX from 'xlsx';

XLSX.set_fs(fs);

export const LINHAS_EXEMPLO = [
  ['Nome', 'E-mail', 'Carga horária'],
  ['Ana Beatriz Souza', 'ana@exemplo.com', null],
  ['Bruno Carvalho', 'bruno@exemplo.com', 12],
  ['Maria Eduarda Albuquerque de Vasconcelos Cavalcanti Pernambucano Sobrinho', 'maria@exemplo.com', null],
  ['João Pedro Nogueira', 'joao@exemplo.com', '4,5'],
  ['', 'semnome@exemplo.com', null],
  ['Bruno  Carvalho', 'outro@exemplo.com', null],
  ['Carla Mendes', 'carla@exemplo.com', -3],
];

export function gerarPlanilhaExemplo(arquivo) {
  const ws = XLSX.utils.aoa_to_sheet(LINHAS_EXEMPLO);
  ws['!cols'] = [{ wch: 70 }, { wch: 24 }, { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Participantes');
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  XLSX.writeFile(wb, arquivo, { compression: true });
  return arquivo;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const arquivo = gerarPlanilhaExemplo(path.join(raiz, 'saidas', 'participantes.xlsx'));
  console.log(`Planilha de exemplo: ${path.relative(raiz, arquivo)}`);
}
