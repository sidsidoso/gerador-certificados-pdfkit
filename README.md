# Gerador de Certificados com PDFKit

[![CI](https://github.com/sidsidoso/gerador-certificados-pdfkit/actions/workflows/ci.yml/badge.svg)](https://github.com/sidsidoso/gerador-certificados-pdfkit/actions/workflows/ci.yml)
![Node.js](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white)
![Licença](https://img.shields.io/badge/licen%C3%A7a-MIT-blue)

CLI em Node.js que lê a lista de participantes de uma planilha (**SheetJS**) e gera **certificados em PDF** com
**PDFKit**: A4 paisagem, borda dupla, título, nome centralizado com **ajuste automático do tamanho da fonte**,
carga horária, **data por extenso em português** (`Intl.DateTimeFormat`) e **código de verificação** derivado de
SHA-256. Gera um PDF por participante ou um único PDF com várias páginas.

![Exemplo de certificado gerado](docs/exemplo-certificado.png)

## Tecnologias

| Tecnologia | Uso |
| --- | --- |
| [Node.js](https://nodejs.org/) ≥ 20 (ESM) | runtime, `node:crypto`, `node:stream`, `parseArgs`, `node:test` |
| [PDFKit](https://pdfkit.org/) | desenho do certificado com as fontes padrão (Helvetica) — nenhum arquivo de fonte externo |
| [SheetJS](https://docs.sheetjs.com/) 0.20.3 | leitura da planilha de participantes (.xlsx/.xls/.csv) |

> **Nota sobre o SheetJS:** o pacote `xlsx` do registro do npm está parado na versão **0.18.5**, desatualizada e
> com vulnerabilidades conhecidas. O projeto SheetJS publica as versões atuais no seu CDN oficial; por isso o
> `package.json` declara `"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"`. O `npm ci` funciona
> normalmente e o `package-lock.json` registra o hash de integridade do pacote.

## Arquitetura

```
 participantes.xlsx/.csv
          │
          ▼
 ┌──────────────────┐   [{ nome, email, cargaHoraria }]   ┌──────────────────────────────┐
 │ participantes.js │ ──────────────────────────────────▶ │ gerador.js                   │
 │ SheetJS + regras │   (rejeitados → aviso no console)   │ montarCertificados():        │
 └──────────────────┘                                     │  + dados do evento           │
                                                          │  + código SHA-256 (texto.js) │
                                                          └──────────────┬───────────────┘
                                                                         │ para cada página
                                                                         ▼
                                                          ┌──────────────────────────────┐
                                                          │ certificado.js               │
                                                          │ borda, títulos, nome com     │
                                                          │ fonte ajustada, data extenso │
                                                          └──────────────┬───────────────┘
                                                                         │ doc.pipe(stream)
                                        ┌────────────────────────────────┴───────────────┐
                                        ▼                                                ▼
                         --unico: certificados.pdf (N páginas)        padrão: 1 PDF por participante
                                        └──────────────── manifesto.json ────────────────┘
```

- `texto.js` e `participantes.js#interpretarLinhas` são funções puras.
- `certificado.js` desenha **uma página** em qualquer `PDFDocument`; `gerador.js` decide se as páginas vão para um
  único arquivo ou para vários.
- `cli.js` apenas lê argumentos, chama os módulos e imprime o resumo.

## Planilha de entrada

| Coluna | Obrigatória | Observações |
| --- | --- | --- |
| `Nome` (ou `Participante`, `Nome completo`) | sim | espaços extras são removidos; até 120 caracteres |
| `E-mail` | não | guardado no manifesto |
| `Carga horária` (ou `Carga`, `Horas`) | não | sobrepõe `--carga` para aquele participante; aceita `4,5` |

Linhas com nome vazio, carga inválida ou nome repetido são ignoradas e informadas no console.

## Opções da CLI

```
node src/cli.js <participantes.xlsx|.csv> --evento "<nome>" [opções]
```

| Opção | Atalho | Padrão | Descrição |
| --- | --- | --- | --- |
| `--evento <texto>` | `-e` | — | nome do evento (**obrigatório**) |
| `--carga <horas>` | `-c` | — | carga horária padrão (obrigatória se a planilha não tiver a coluna) |
| `--data <data>` | `-d` | hoje | `AAAA-MM-DD` ou `DD/MM/AAAA` |
| `--instituicao <texto>` | `-i` | — | instituição promotora (topo e corpo do texto) |
| `--local <texto>` | `-l` | — | cidade exibida antes da data |
| `--responsavel <texto>` | `-r` | `Coordenação` | nome de quem assina |
| `--cargo <texto>` | | `Responsável pelo evento` | cargo de quem assina |
| `--aba <nome>` | `-a` | primeira aba | aba da planilha |
| `--saida <pasta>` | `-o` | `saidas/certificados` | pasta de saída |
| `--unico` | `-u` | `false` | gera `certificados.pdf` com uma página por participante |
| `--help` | `-h` | | ajuda |

Variável de ambiente opcional **`CERT_SEGREDO`** (veja [`.env.example`](.env.example)): quando definida, o código
de verificação passa a ser **HMAC-SHA256** com essa chave.

## Exemplo real

```console
$ npm run exemplo
Planilha de exemplo: saidas/participantes.xlsx
  ignorado (linha 6): nome ausente
  ignorado (linha 7): participante duplicado
  ignorado (linha 8): carga horária inválida: "-3"
4 certificado(s) de "Semana de Tecnologia 2026" — 5 de novembro de 2026
  E818-B1C1-1DCC  Ana Beatriz Souza
  4B23-310C-CDC8  Bruno Carvalho
  1B49-E510-3BF8  Maria Eduarda Albuquerque de Vasconcelos Cavalcanti Pernambucano Sobrinho
  CF73-ED2E-A279  João Pedro Nogueira
4 PDF(s) em saidas/certificados (49 ms)
Manifesto: saidas/certificados/manifesto.json
```

O script `exemplo` gera a planilha (não há binário versionado) e roda:

```bash
node src/cli.js saidas/participantes.xlsx --evento "Semana de Tecnologia 2026" --carga 8 --data 2026-11-05 \
  --instituicao "Faculdade de Computação" --local "São Paulo" \
  --responsavel "Profa. Helena Martins" --cargo "Coordenadora do evento"
```

Arquivos gerados:

```
saidas/certificados/
├── certificado-ana-beatriz-souza-E818-B1C1-1DCC.pdf
├── certificado-bruno-carvalho-4B23-310C-CDC8.pdf
├── certificado-joao-pedro-nogueira-CF73-ED2E-A279.pdf
├── certificado-maria-eduarda-albuquerque-de-vasconcelos-cavalcanti-pernambu-1B49-E510-3BF8.pdf
└── manifesto.json
```

Modo **PDF único** (`--unico`) — o manifesto indica a página de cada participante:

```console
$ node src/cli.js saidas/participantes.xlsx -e "Semana de Tecnologia 2026" -c 8 -d 2026-11-05 --unico -o saidas/turma-a
...
1 PDF(s) em saidas/turma-a (36 ms)
Manifesto: saidas/turma-a/manifesto.json
```

```json
{
  "nome": "Ana Beatriz Souza",
  "email": "ana@exemplo.com",
  "evento": "Semana de Tecnologia 2026",
  "cargaHoraria": 8,
  "data": "2026-11-05",
  "codigo": "E818-B1C1-1DCC",
  "arquivo": "certificados.pdf",
  "pagina": 1
}
```

Com `CERT_SEGREDO=minha-chave`, os mesmos dados produzem outros códigos (`903F-804E-83FC` para Ana,
`A6D9-0C7F-C9EB` para Bruno), que só podem ser reproduzidos por quem conhece a chave.

## Decisões de implementação

**Layout**
- A4 paisagem (`size: 'A4', layout: 'landscape'`), `margin: 0` e coordenadas absolutas: nada "transborda" para uma
  página extra.
- **Ajuste do nome em O(1):** nas fontes padrão a largura do texto é linear no tamanho da fonte. O nome é medido uma
  única vez em 1 pt e o tamanho ideal é `largura disponível / largura em 1 pt`, limitado entre 14 e 36 pt — sem laço
  de tentativa e erro.
- Apenas Helvetica/Helvetica-Bold (fontes padrão do PDF): arquivos menores e nenhum `.ttf` no repositório; os
  acentos do português são suportados pela codificação WinAnsi.

**Data por extenso**
- `Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })` → `5 de novembro de 2026`.
- Datas são criadas em UTC à meia-noite e formatadas em UTC, então o dia não muda conforme o fuso da máquina.

**Código de verificação**
- `SHA-256(JSON.stringify([nome, evento, data, cargaHoraria]))`, 12 primeiros dígitos hexadecimais em grupos de 4.
  `JSON.stringify` evita ambiguidades de concatenação (ex.: `"ab" + "c"` × `"a" + "bc"`).
- Com `CERT_SEGREDO`, vira **HMAC-SHA256**: sem a chave não é possível forjar um código válido.
- O `manifesto.json` registra todos os códigos emitidos para conferência.

**Desempenho e segurança**
- PDFs gerados **por stream** (`doc.pipe(fs.createWriteStream())` + `stream/promises.finished`) — nada é acumulado
  em memória.
- Modo individual com **concorrência limitada** (4 documentos simultâneos), preservando a ordem do resultado.
- Nome do arquivo derivado do participante é "slugificado" (sem acentos, `/`, `\`, `..`), impedindo path traversal.
- Limites: planilha de até 5 MB e 5 000 participantes; textos da CLI com até 200 caracteres; carga entre 0 e 1000 h.
- SheetJS 0.20.3 do CDN oficial, lendo sem fórmulas/HTML.

## Como instalar, rodar e testar

Pré-requisito: Node.js 20 ou superior.

**Linux / macOS**

```bash
git clone https://github.com/sidsidoso/gerador-certificados-pdfkit.git
cd gerador-certificados-pdfkit
npm ci
npm run exemplo                       # gera planilha + certificados em saidas/
CERT_SEGREDO=minha-chave npm start -- saidas/participantes.xlsx -e "Oficina de Git" -c 4 --unico
npm test
```

**Windows (PowerShell)**

```powershell
git clone https://github.com/sidsidoso/gerador-certificados-pdfkit.git
cd gerador-certificados-pdfkit
npm ci
npm run exemplo
$env:CERT_SEGREDO = "minha-chave"; npm start -- saidas\participantes.xlsx -e "Oficina de Git" -c 4 --unico
npm test
```

Também é possível copiar `.env.example` para `.env`: a CLI carrega o arquivo automaticamente (Node ≥ 20.12).

Saída dos testes:

```console
$ npm test
ℹ tests 13
ℹ suites 0
ℹ pass 13
ℹ fail 0
```

Os testes verificam que cada PDF começa com `%PDF-`, contam as páginas (`/Type /Page`), conferem o ajuste da fonte,
a data por extenso, o código de verificação, a sanitização do nome do arquivo e a leitura da planilha.

## Estrutura de pastas

```
gerador-certificados-pdfkit/
├── .github/workflows/ci.yml   # CI: Node 20 e 22
├── docs/
│   └── exemplo-certificado.png
├── scripts/
│   └── gerar-exemplo.js       # planilha de exemplo (npm run exemplo)
├── src/
│   ├── cli.js                 # parseArgs e resumo
│   ├── participantes.js       # leitura e validação da planilha (SheetJS)
│   ├── gerador.js             # PDF único / individuais / manifesto
│   ├── certificado.js         # desenho da página (PDFKit)
│   └── texto.js               # data por extenso, código SHA-256, slug
├── tests/
│   ├── participantes.test.js
│   ├── pdf.test.js
│   └── texto.test.js
├── .env.example
├── LICENSE
└── package.json
```

## Referências

- [PDFKit — documentação](https://pdfkit.org/docs/getting_started.html) e [texto](https://pdfkit.org/docs/text.html)
- [SheetJS — instalação no Node.js (CDN)](https://docs.sheetjs.com/docs/getting-started/installation/nodejs)
- [MDN — `Intl.DateTimeFormat`](https://developer.mozilla.org/pt-BR/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat)
- [Node.js — `crypto.createHash` / `createHmac`](https://nodejs.org/api/crypto.html)
- [Node.js — `stream/promises.finished`](https://nodejs.org/api/stream.html#streamfinishedstream-options)

## Licença

[MIT](LICENSE) © 2026 sidsidoso
