// Desenho de uma página de certificado com PDFKit (A4 paisagem, fontes padrão Helvetica).
import { dataPorExtenso, formatarHoras } from './texto.js';

const COR = { primaria: '#1F3A5F', destaque: '#B8902A', texto: '#222222', suave: '#6B7280' };
export const NOME_TAMANHO_MAX = 36;
export const NOME_TAMANHO_MIN = 14;

/**
 * Maior tamanho de fonte (entre min e max) em que `texto` cabe em `largura`.
 * Nas fontes padrão a largura é linear no tamanho, então basta medir uma vez em 1 pt.
 */
export function ajustarTamanhoFonte(medirEm1pt, largura, { max = NOME_TAMANHO_MAX, min = NOME_TAMANHO_MIN } = {}) {
  const w1 = medirEm1pt();
  if (w1 <= 0) return max;
  const ideal = Math.floor((largura / w1) * 10) / 10; // uma casa decimal
  return Math.max(min, Math.min(max, ideal));
}

/** Escreve texto centralizado na largura útil da página. */
function centralizado(doc, texto, y, { fonte = 'Helvetica', tamanho = 14, cor = COR.texto, espacamento = 0, margem = 60 } = {}) {
  doc.font(fonte).fontSize(tamanho).fillColor(cor)
    .text(texto, margem, y, { width: doc.page.width - margem * 2, align: 'center', characterSpacing: espacamento });
}

/**
 * Desenha um certificado na página atual do documento.
 * dados: { nome, evento, cargaHoraria, data (Date), codigo, instituicao?, local?, responsavel?, cargo? }
 */
export function desenharCertificado(doc, dados) {
  const { width: L, height: A } = doc.page;

  // Bordas: externa grossa e interna fina.
  doc.save();
  doc.lineWidth(6).strokeColor(COR.primaria).rect(20, 20, L - 40, A - 40).stroke();
  doc.lineWidth(1.5).strokeColor(COR.destaque).rect(32, 32, L - 64, A - 64).stroke();
  doc.restore();

  if (dados.instituicao) centralizado(doc, dados.instituicao.toUpperCase(), 62, { tamanho: 12, cor: COR.suave, espacamento: 2 });
  centralizado(doc, 'CERTIFICADO', 92, { fonte: 'Helvetica-Bold', tamanho: 46, cor: COR.primaria, espacamento: 6 });
  centralizado(doc, 'DE PARTICIPAÇÃO', 148, { tamanho: 15, cor: COR.destaque, espacamento: 4 });
  centralizado(doc, 'Certificamos que', 200, { tamanho: 16 });

  // Nome: fonte ajustada para caber em uma linha.
  const larguraNome = L - 200;
  const tamanho = ajustarTamanhoFonte(
    () => doc.font('Helvetica-Bold').fontSize(1).widthOfString(dados.nome),
    larguraNome,
  );
  const alturaNome = doc.font('Helvetica-Bold').fontSize(tamanho).currentLineHeight();
  doc.fillColor(COR.texto).text(dados.nome, 100, 262 - alturaNome / 2, { width: larguraNome, align: 'center' });
  doc.save().lineWidth(1).strokeColor(COR.destaque).moveTo(150, 290).lineTo(L - 150, 290).stroke().restore();

  const promovido = dados.instituicao ? `, promovido por ${dados.instituicao},` : '';
  centralizado(doc,
    `participou do evento “${dados.evento}”${promovido} com carga horária de ${formatarHoras(dados.cargaHoraria)}.`,
    310, { tamanho: 15, margem: 110 });

  const local = dados.local ? `${dados.local}, ` : '';
  centralizado(doc, `${local}${dataPorExtenso(dados.data)}.`, 390, { tamanho: 13 });

  // Assinatura.
  doc.save().lineWidth(0.8).strokeColor(COR.texto).moveTo(L / 2 - 130, 470).lineTo(L / 2 + 130, 470).stroke().restore();
  centralizado(doc, dados.responsavel || 'Coordenação', 477, { fonte: 'Helvetica-Bold', tamanho: 12 });
  centralizado(doc, dados.cargo || 'Responsável pelo evento', 493, { tamanho: 10, cor: COR.suave });

  centralizado(doc, `Código de verificação: ${dados.codigo}`, A - 62, { tamanho: 9, cor: COR.suave, espacamento: 0.5 });
  return tamanho;
}
