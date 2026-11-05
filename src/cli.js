#!/usr/bin/env node
// CLI: lê a planilha de participantes e gera os certificados em PDF.
import { parseArgs } from 'node:util';
import path from 'node:path';
import { lerParticipantes } from './participantes.js';
import { montarCertificados, gerarPdfUnico, gerarPdfsIndividuais, gravarManifesto } from './gerador.js';
import { lerData, dataPorExtenso } from './texto.js';

const AJUDA = `Uso: node src/cli.js <participantes.xlsx|.csv> --evento "<nome>" [opções]

Opções:
  -e, --evento <texto>       Nome do evento (obrigatório)
  -c, --carga <horas>        Carga horária padrão (a coluna "Carga horária" da planilha tem prioridade)
  -d, --data <data>          Data do evento: AAAA-MM-DD ou DD/MM/AAAA (padrão: hoje)
  -i, --instituicao <texto>  Instituição promotora
  -l, --local <texto>        Cidade exibida antes da data
  -r, --responsavel <texto>  Nome de quem assina
      --cargo <texto>        Cargo de quem assina
  -a, --aba <nome>           Aba da planilha (padrão: primeira)
  -o, --saida <pasta>        Pasta de saída (padrão: saidas/certificados)
  -u, --unico                Gera um único PDF com uma página por participante
  -h, --help                 Mostra esta ajuda

Variável de ambiente opcional: CERT_SEGREDO (usa HMAC-SHA256 no código de verificação).`;

const LIMITE_TEXTO = 200;

/** Data de hoje no fuso local (evita "pular" um dia perto da meia-noite UTC). */
function hojeLocal() {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

function texto(valor, nome) {
  if (valor === undefined) return undefined;
  const t = valor.trim();
  if (t.length > LIMITE_TEXTO) throw new Error(`--${nome} deve ter até ${LIMITE_TEXTO} caracteres`);
  return t;
}

async function main(argv) {
  const { values: v, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      evento: { type: 'string', short: 'e' },
      carga: { type: 'string', short: 'c' },
      data: { type: 'string', short: 'd' },
      instituicao: { type: 'string', short: 'i' },
      local: { type: 'string', short: 'l' },
      responsavel: { type: 'string', short: 'r' },
      cargo: { type: 'string' },
      aba: { type: 'string', short: 'a' },
      saida: { type: 'string', short: 'o', default: path.join('saidas', 'certificados') },
      unico: { type: 'boolean', short: 'u', default: false },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (v.help) { console.log(AJUDA); return 0; }
  if (positionals.length !== 1 || !v.evento?.trim()) { console.error(AJUDA); return 1; }

  const carga = v.carga === undefined ? undefined : Number(v.carga.replace(',', '.'));
  if (carga !== undefined && !(carga > 0 && carga <= 1000)) throw new Error('--carga deve ser um número entre 0 e 1000');

  const evento = {
    evento: texto(v.evento, 'evento'),
    data: lerData(v.data ?? hojeLocal()),
    cargaHoraria: carga,
    instituicao: texto(v.instituicao, 'instituicao'),
    local: texto(v.local, 'local'),
    responsavel: texto(v.responsavel, 'responsavel'),
    cargo: texto(v.cargo, 'cargo'),
  };

  const inicio = performance.now();
  const { participantes, rejeitados } = lerParticipantes(positionals[0], { aba: v.aba });
  for (const r of rejeitados) console.warn(`  ignorado (linha ${r.linha}): ${r.motivo}`);
  if (participantes.length === 0) throw new Error('nenhum participante válido na planilha');

  const certificados = montarCertificados(participantes, evento, process.env.CERT_SEGREDO);
  const arquivos = v.unico
    ? [await gerarPdfUnico(certificados, path.join(v.saida, 'certificados.pdf'))]
    : await gerarPdfsIndividuais(certificados, v.saida);
  const manifesto = gravarManifesto(certificados, path.join(v.saida, 'manifesto.json'),
    { pdfUnico: v.unico ? path.basename(arquivos[0]) : undefined });

  console.log(`${certificados.length} certificado(s) de "${evento.evento}" — ${dataPorExtenso(evento.data)}`);
  for (const c of certificados) console.log(`  ${c.codigo}  ${c.nome}`);
  console.log(`${arquivos.length} PDF(s) em ${v.saida} (${Math.round(performance.now() - inicio)} ms)`);
  console.log(`Manifesto: ${manifesto}`);
  return 0;
}

// Carrega .env (CERT_SEGREDO) se existir; process.loadEnvFile existe desde o Node 20.12.
try { process.loadEnvFile?.(); } catch { /* sem .env */ }

main(process.argv.slice(2)).then(
  (codigo) => { process.exitCode = codigo; },
  (e) => { console.error(`Erro: ${e.message}`); process.exitCode = 1; },
);
