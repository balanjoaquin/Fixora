import { useMemo, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  Download,
  MapPin,
  Printer,
  ShieldCheck,
  Star,
  User,
  Wrench,
  X,
} from "lucide-react";
import techLogoImg from "@/imports/LOGO_DE_T_CNICOS_copia.png";
import fixoraWordmarkImg from "@/imports/Logo_fixora.png";

export interface ReceiptReviewData {
  rating: number;
  comment?: string | null;
  technician_reply?: string | null;
  created_at?: string;
}

export interface ReceiptOrderData {
  id: number;
  status: string;
  title: string;
  description: string;
  approx_zone?: string | null;
  address_line?: string | null;
  address?: string | null;
  preferred_date?: string | null;
  preferred_start?: string | null;
  preferred_time?: string | null;
  completed_at?: string | null;
  created_at?: string | null;
  client?: { id?: number; name?: string | null; phone?: string | null } | null;
  technician_profile?: {
    id?: number;
    headline?: string | null;
    service_zone?: string | null;
    user?: { id?: number; name?: string | null; phone?: string | null } | null;
  } | null;
  technician?: { name?: string | null; phone?: string | null } | null;
  specialty?: { id?: number; name?: string | null } | null;
  technician_service?: {
    id?: number;
    title?: string | null;
    reference_price?: string | number | null;
  } | null;
  review?: ReceiptReviewData | null;
  events?: Array<{ id?: number; reason?: string | null; created_at?: string }>;
}

interface ServiceReceiptModalProps {
  order: ReceiptOrderData | null;
  onClose: () => void;
}

interface EmbeddedJpegImage {
  bytes: Uint8Array;
  width: number;
  height: number;
}

function extractAgreedAmount(order: ReceiptOrderData): {
  amount: number | null;
  sourceLabel: string;
} {
  if (Array.isArray(order.events)) {
    for (let i = order.events.length - 1; i >= 0; i -= 1) {
      const reason = String(order.events[i]?.reason ?? "");
      const match = reason.match(
        /\[COTIZACIÓN:\s*\$([0-9]+(?:\.[0-9]{1,2})?)\s*MXN\]/i
      );
      if (match && match[1]) {
        return {
          amount: Number(match[1]),
          sourceLabel: "Cotización acordada en diálogo",
        };
      }
    }
  }

  const refPrice = order.technician_service?.reference_price;
  if (
    refPrice !== null &&
    refPrice !== undefined &&
    String(refPrice).trim() !== ""
  ) {
    const parsed = Number(refPrice);
    if (!Number.isNaN(parsed)) {
      return {
        amount: parsed,
        sourceLabel: "Tarifa de referencia del catálogo",
      };
    }
  }

  return {
    amount: null,
    sourceLabel: "Acordado directamente entre partes",
  };
}

/**
 * Convierte texto Unicode a bytes WinAnsi (Windows-1252) escapados para literales PDF (...)
 * manteniendo acentos en español (á, é, í, ó, ú, ñ, Ñ, ü, ¡, ¿).
 */
function encodeWinAnsiPdfLiteral(input: string): Uint8Array {
  const bytes: number[] = [];

  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    let winByte = 0x20;

    if (code >= 0x20 && code <= 0x7e) {
      winByte = code;
    } else if (code >= 0xa0 && code <= 0xff) {
      winByte = code;
    } else if (code === 0x2022) {
      winByte = 0x95; // •
    } else if (code === 0x2013) {
      winByte = 0x96; // –
    } else if (code === 0x2014) {
      winByte = 0x97; // —
    } else if (code === 0x201c || code === 0x201d) {
      winByte = 0x22; // "
    } else if (code === 0x2018 || code === 0x2019) {
      winByte = 0x27; // '
    } else {
      const fallback = input[i]
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      const fbCode = fallback.charCodeAt(0);
      winByte = fbCode >= 0x20 && fbCode <= 0x7e ? fbCode : 0x20;
    }

    if (winByte === 0x5c || winByte === 0x28 || winByte === 0x29) {
      bytes.push(0x5c); // '\'
    }
    bytes.push(winByte);
  }

  return new Uint8Array(bytes);
}

function asciiToBytes(str: string): Uint8Array {
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i += 1) {
    out[i] = str.charCodeAt(i) & 0xff;
  }
  return out;
}

class PdfByteBuilder {
  private chunks: Uint8Array[] = [];
  private totalLength = 0;

  get length(): number {
    return this.totalLength;
  }

  appendAscii(text: string): void {
    const bytes = asciiToBytes(text);
    this.chunks.push(bytes);
    this.totalLength += bytes.length;
  }

  appendBytes(bytes: Uint8Array): void {
    this.chunks.push(bytes);
    this.totalLength += bytes.length;
  }

  appendPdfText(text: string): void {
    this.appendAscii("(");
    this.appendBytes(encodeWinAnsiPdfLiteral(text));
    this.appendAscii(")");
  }

  toBlob(): Blob {
    const merged = new Uint8Array(this.totalLength);
    let offset = 0;
    for (const chunk of this.chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    return new Blob([merged], { type: "application/pdf" });
  }
}

function estimateTextWidth(
  text: string,
  fontSize: number,
  bold = false
): number {
  let units = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if ("ilI.,:;!'| ".includes(ch)) {
      units += 0.3;
    } else if ("fjrt()-/[]".includes(ch)) {
      units += 0.38;
    } else if ("MWOQG@%#".includes(ch)) {
      units += 0.78;
    } else if (ch >= "A" && ch <= "Z") {
      units += 0.64;
    } else {
      units += 0.53;
    }
  }
  return units * fontSize * (bold ? 1.05 : 1);
}

function wrapTextLines(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word.length > maxChars ? word.slice(0, maxChars) : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

async function loadImageAsJpeg(
  src: string,
  bgColor = "#FFFFFF"
): Promise<EmbeddedJpegImage | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const naturalW = img.naturalWidth || 200;
        const naturalH = img.naturalHeight || 200;
        const scale = naturalW < 240 ? 2 : 1;
        const canvas = document.createElement("canvas");
        canvas.width = naturalW * scale;
        canvas.height = naturalH * scale;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }

        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
        const base64 = dataUrl.split(",")[1];
        if (!base64) {
          resolve(null);
          return;
        }

        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
          bytes[i] = binary.charCodeAt(i);
        }

        resolve({
          bytes,
          width: canvas.width,
          height: canvas.height,
        });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

interface PdfReceiptPayload {
  folio: string;
  orderId: number;
  dateText: string;
  clientName: string;
  clientPhone: string;
  techName: string;
  techPhone: string;
  specialtyName: string;
  title: string;
  description: string;
  packageTitle?: string | null;
  locationText: string;
  scheduledText: string;
  priceFormatted: string;
  priceSourceLabel: string;
  review?: ReceiptReviewData | null;
  emblemImg: EmbeddedJpegImage | null;
  wordmarkImg: EmbeddedJpegImage | null;
}

function buildStyledFixoraPdfBlob(data: PdfReceiptPayload): Blob {
  // Hoja Carta en puntos: 612 x 792
  const pageW = 612;
  const centerX = pageW / 2; // 306

  // Tarjeta principal centrada
  const cardX = 46;
  const cardW = 520;
  const cardTop = 756;
  const cardBottom = 42;
  const cardH = cardTop - cardBottom; // 714

  const stream = new PdfByteBuilder();

  const drawTextLeft = (
    text: string,
    x: number,
    y: number,
    size: number,
    bold: boolean,
    rgb: string
  ) => {
    stream.appendAscii(`${rgb} rg\nBT\n${bold ? "/F2" : "/F1"} ${size} Tf\n`);
    stream.appendAscii(`${x.toFixed(2)} ${y.toFixed(2)} Td\n`);
    stream.appendPdfText(text);
    stream.appendAscii(" Tj\nET\n");
  };

  const drawTextCentered = (
    text: string,
    y: number,
    size: number,
    bold: boolean,
    rgb: string
  ) => {
    const w = estimateTextWidth(text, size, bold);
    const x = Math.max(cardX + 14, centerX - w / 2);
    drawTextLeft(text, x, y, size, bold, rgb);
  };

  const drawTextRight = (
    text: string,
    rightX: number,
    y: number,
    size: number,
    bold: boolean,
    rgb: string
  ) => {
    const w = estimateTextWidth(text, size, bold);
    const x = rightX - w;
    drawTextLeft(text, x, y, size, bold, rgb);
  };

  // Fondo suave de página (#F1F5F9)
  stream.appendAscii("0.945 0.961 0.976 rg\n0 0 612 792 re f\n");

  // Sombra dura estilo Fixora (#0F172A) desplazada +5pt X, -5pt Y
  stream.appendAscii("0.059 0.090 0.165 rg\n");
  stream.appendAscii(`${cardX + 5} ${cardBottom - 5} ${cardW} ${cardH} re f\n`);

  // Contenedor blanco principal de la tarjeta
  stream.appendAscii("1 1 1 rg\n");
  stream.appendAscii(`${cardX} ${cardBottom} ${cardW} ${cardH} re f\n`);

  // -------------------------------------------------------------------------
  // 1. CABECERA DE LOGOTIPOS CENTRADOS (y = 682 a 756)
  // -------------------------------------------------------------------------
  const logoBannerBottom = 682;
  const logoBannerH = cardTop - logoBannerBottom; // 74 pt

  if (data.emblemImg && data.wordmarkImg) {
    const emblemH = 48;
    const emblemW = emblemH * (data.emblemImg.width / data.emblemImg.height);
    const wordmarkH = 34;
    const wordmarkW =
      wordmarkH * (data.wordmarkImg.width / data.wordmarkImg.height);
    const gap = 12;
    const totalW = emblemW + gap + wordmarkW;
    const startX = centerX - totalW / 2;

    const emblemY = logoBannerBottom + (logoBannerH - emblemH) / 2;
    const wordmarkY = logoBannerBottom + (logoBannerH - wordmarkH) / 2;

    stream.appendAscii(
      `q\n${emblemW.toFixed(2)} 0 0 ${emblemH.toFixed(2)} ${startX.toFixed(
        2
      )} ${emblemY.toFixed(2)} cm\n/Im1 Do\nQ\n`
    );
    stream.appendAscii(
      `q\n${wordmarkW.toFixed(2)} 0 0 ${wordmarkH.toFixed(2)} ${(
        startX +
        emblemW +
        gap
      ).toFixed(2)} ${wordmarkY.toFixed(2)} cm\n/Im2 Do\nQ\n`
    );
  } else if (data.wordmarkImg) {
    const wordmarkH = 38;
    const wordmarkW =
      wordmarkH * (data.wordmarkImg.width / data.wordmarkImg.height);
    const startX = centerX - wordmarkW / 2;
    const wordmarkY = logoBannerBottom + (logoBannerH - wordmarkH) / 2;
    stream.appendAscii(
      `q\n${wordmarkW.toFixed(2)} 0 0 ${wordmarkH.toFixed(2)} ${startX.toFixed(
        2
      )} ${wordmarkY.toFixed(2)} cm\n/Im2 Do\nQ\n`
    );
  } else {
    drawTextCentered("FIXORA", 712, 22, true, "0.059 0.090 0.165");
  }

  // -------------------------------------------------------------------------
  // 2. BANDA AZUL MARINO CON FOLIO CENTRADO (y = 602 a 682)
  // -------------------------------------------------------------------------
  const darkHeaderBottom = 602;
  const darkHeaderH = logoBannerBottom - darkHeaderBottom; // 80 pt
  stream.appendAscii("0.043 0.067 0.125 rg\n");
  stream.appendAscii(
    `${cardX} ${darkHeaderBottom} ${cardW} ${darkHeaderH} re f\n`
  );

  drawTextCentered(
    "COMPROBANTE OFICIAL DE SERVICIO  •  FINALIZADO",
    661,
    9,
    true,
    "0.376 0.647 0.980"
  );
  drawTextCentered(
    `ORDEN DE SERVICIO ${data.folio}`,
    635,
    20,
    true,
    "1 1 1"
  );
  drawTextCentered(
    `Emisión: ${data.dateText}  •  Folio de control: #${data.orderId}`,
    615,
    9.5,
    false,
    "0.796 0.835 0.882"
  );

  // -------------------------------------------------------------------------
  // 3. FRANJA DE SEGURIDAD AMARILLA / NEGRA (y = 592 a 602)
  // -------------------------------------------------------------------------
  const stripeY = 592;
  const stripeH = 10;
  stream.appendAscii("q\n");
  stream.appendAscii(`${cardX} ${stripeY} ${cardW} ${stripeH} re W n\n`);
  stream.appendAscii("0.980 0.800 0.082 rg\n");
  stream.appendAscii(`${cardX} ${stripeY} ${cardW} ${stripeH} re f\n`);
  stream.appendAscii("0.059 0.090 0.165 rg\n");
  for (let sx = cardX - 20; sx < cardX + cardW + 20; sx += 22) {
    stream.appendAscii(
      `${sx} ${stripeY} m ${sx + 10} ${stripeY} l ${sx + 18} ${
        stripeY + stripeH
      } l ${sx + 8} ${stripeY + stripeH} l h f\n`
    );
  }
  stream.appendAscii("Q\n");

  // Líneas divisoras de la franja
  stream.appendAscii("0.059 0.090 0.165 RG 1 w\n");
  stream.appendAscii(`${cardX} 602 m ${cardX + cardW} 602 l S\n`);
  stream.appendAscii(`${cardX} 592 m ${cardX + cardW} 592 l S\n`);

  // -------------------------------------------------------------------------
  // 4. CONTENEDOR PUNTEADO INTERNO (x = 64, w = 484, y = 104 a 576)
  // -------------------------------------------------------------------------
  const innerX = 64;
  const innerW = 484;
  const innerBottom = 104;
  const innerTop = 576;
  stream.appendAscii("q\n0.580 0.639 0.722 RG 1 w [4 3] 0 d\n");
  stream.appendAscii(
    `${innerX} ${innerBottom} ${innerW} ${innerTop - innerBottom} re S\nQ\n`
  );

  // -------------------------------------------------------------------------
  // 5. DATOS DE LAS PARTES (2 COLUMNAS CENTRADAS, y = 478 a 562)
  // -------------------------------------------------------------------------
  const colGap = 12;
  const colW = (innerW - 28 - colGap) / 2; // 222 pt
  const leftColX = innerX + 14; // 78
  const rightColX = leftColX + colW + colGap; // 312
  const partiesY = 478;
  const partiesH = 84;

  // Caja Cliente
  stream.appendAscii("0.973 0.980 0.988 rg 0.796 0.835 0.882 RG 0.8 w\n");
  stream.appendAscii(`${leftColX} ${partiesY} ${colW} ${partiesH} re B\n`);
  drawTextLeft(
    "DATOS DEL CLIENTE",
    leftColX + 12,
    partiesY + 67,
    8,
    true,
    "0.392 0.455 0.545"
  );
  const clientLines = wrapTextLines(data.clientName, 28).slice(0, 2);
  clientLines.forEach((line, idx) => {
    drawTextLeft(
      line,
      leftColX + 12,
      partiesY + 49 - idx * 13,
      10.5,
      true,
      "0.059 0.090 0.165"
    );
  });
  drawTextLeft(
    `Tel: ${data.clientPhone}`,
    leftColX + 12,
    partiesY + 14,
    9,
    false,
    "0.278 0.333 0.412"
  );

  // Caja Técnico
  stream.appendAscii("0.937 0.965 1.000 rg 0.749 0.859 0.996 RG 0.8 w\n");
  stream.appendAscii(`${rightColX} ${partiesY} ${colW} ${partiesH} re B\n`);
  drawTextLeft(
    "TÉCNICO ESPECIALISTA",
    rightColX + 12,
    partiesY + 67,
    8,
    true,
    "0.114 0.388 0.929"
  );
  const techLines = wrapTextLines(data.techName, 28).slice(0, 2);
  techLines.forEach((line, idx) => {
    drawTextLeft(
      line,
      rightColX + 12,
      partiesY + 49 - idx * 13,
      10.5,
      true,
      "0.059 0.090 0.165"
    );
  });
  const techSub = wrapTextLines(
    `${data.specialtyName} • Tel: ${data.techPhone}`,
    34
  )[0];
  if (techSub) {
    drawTextLeft(
      techSub,
      rightColX + 12,
      partiesY + 14,
      8.5,
      false,
      "0.278 0.333 0.412"
    );
  }

  // -------------------------------------------------------------------------
  // 6. ALCANCE DEL SERVICIO ACORDADO (y = 320 a 466)
  // -------------------------------------------------------------------------
  const scopeX = leftColX;
  const scopeW = innerW - 28; // 456
  const scopeY = 320;
  const scopeH = 146;

  stream.appendAscii("1 1 1 rg 0.796 0.835 0.882 RG 0.8 w\n");
  stream.appendAscii(`${scopeX} ${scopeY} ${scopeW} ${scopeH} re B\n`);

  // Barra de encabezado de sección
  stream.appendAscii("0.945 0.961 0.976 rg\n");
  stream.appendAscii(`${scopeX + 0.5} ${scopeY + scopeH - 22} ${scopeW - 1} 21.5 re f\n`);
  drawTextLeft(
    "ALCANCE DEL SERVICIO ACORDADO",
    scopeX + 12,
    scopeY + scopeH - 15,
    8,
    true,
    "0.278 0.333 0.412"
  );
  drawTextRight(
    data.specialtyName.toUpperCase(),
    scopeX + scopeW - 12,
    scopeY + scopeH - 15,
    8,
    true,
    "0.114 0.388 0.929"
  );

  // Título y descripción del servicio
  const titleLine = wrapTextLines(data.title, 62)[0] ?? data.title;
  drawTextLeft(
    titleLine,
    scopeX + 12,
    scopeY + 106,
    12,
    true,
    "0.059 0.090 0.165"
  );

  const descLines = wrapTextLines(data.description, 74).slice(0, 3);
  descLines.forEach((line, idx) => {
    drawTextLeft(
      line,
      scopeX + 12,
      scopeY + 89 - idx * 13,
      9.5,
      false,
      "0.200 0.255 0.333"
    );
  });

  if (data.packageTitle) {
    const pkgLine =
      wrapTextLines(`Paquete / Servicio base: ${data.packageTitle}`, 74)[0] ??
      "";
    drawTextLeft(
      pkgLine,
      scopeX + 12,
      scopeY + 46,
      8.5,
      true,
      "0.024 0.373 0.275"
    );
  }

  // Línea separadora y ubicación/fecha
  stream.appendAscii("0.886 0.910 0.941 RG 0.7 w\n");
  stream.appendAscii(
    `${scopeX + 12} ${scopeY + 34} m ${scopeX + scopeW - 12} ${scopeY + 34} l S\n`
  );

  const locLine =
    wrapTextLines(`Ubicación: ${data.locationText}`, 44)[0] ??
    `Ubicación: ${data.locationText}`;
  drawTextLeft(
    locLine,
    scopeX + 12,
    scopeY + 15,
    8.5,
    false,
    "0.278 0.333 0.412"
  );
  drawTextRight(
    `Programado: ${data.scheduledText}`,
    scopeX + scopeW - 12,
    scopeY + 15,
    8.5,
    false,
    "0.278 0.333 0.412"
  );

  // -------------------------------------------------------------------------
  // 7. COTIZACIÓN / PRECIO ACORDADO (y = 248 a 308)
  // -------------------------------------------------------------------------
  const priceY = 248;
  const priceH = 60;
  stream.appendAscii("0.043 0.067 0.125 rg\n");
  stream.appendAscii(`${scopeX} ${priceY} ${scopeW} ${priceH} re f\n`);

  drawTextLeft(
    "COTIZACIÓN / PRECIO ACORDADO",
    scopeX + 16,
    priceY + 39,
    8.5,
    true,
    "0.576 0.773 0.992"
  );
  drawTextLeft(
    data.priceSourceLabel,
    scopeX + 16,
    priceY + 20,
    9.5,
    false,
    "0.796 0.835 0.882"
  );
  drawTextRight(
    data.priceFormatted,
    scopeX + scopeW - 16,
    priceY + 23,
    18,
    true,
    "0.980 0.800 0.082"
  );

  // -------------------------------------------------------------------------
  // 8. CALIFICACIÓN Y RESEÑA (y = 118 a 236)
  // -------------------------------------------------------------------------
  const revY = 118;
  const revH = 118;
  stream.appendAscii("1.000 0.984 0.922 rg 0.992 0.902 0.541 RG 0.9 w\n");
  stream.appendAscii(`${scopeX} ${revY} ${scopeW} ${revH} re B\n`);

  drawTextLeft(
    "CALIFICACIÓN Y RESEÑA DEL CLIENTE",
    scopeX + 14,
    revY + 99,
    8.5,
    true,
    "0.471 0.208 0.059"
  );

  if (data.review) {
    drawTextRight(
      `Calificación: ${data.review.rating} / 5 estrellas`,
      scopeX + scopeW - 14,
      revY + 99,
      9.5,
      true,
      "0.706 0.325 0.035"
    );

    const commentText = data.review.comment
      ? `"${data.review.comment}"`
      : "Calificación registrada sin comentario adicional.";
    const commentLines = wrapTextLines(commentText, 72).slice(0, 3);
    commentLines.forEach((line, idx) => {
      drawTextLeft(
        line,
        scopeX + 14,
        revY + 78 - idx * 13,
        9.5,
        false,
        "0.118 0.161 0.231"
      );
    });

    if (data.review.technician_reply) {
      const replyLines = wrapTextLines(
        `Respuesta del especialista: ${data.review.technician_reply}`,
        72
      ).slice(0, 2);
      replyLines.forEach((line, idx) => {
        drawTextLeft(
          line,
          scopeX + 14,
          revY + 34 - idx * 12,
          8.5,
          idx === 0,
          "0.114 0.388 0.929"
        );
      });
    }
  } else {
    drawTextRight(
      "Pendiente de calificación",
      scopeX + scopeW - 14,
      revY + 99,
      8.5,
      true,
      "0.573 0.251 0.055"
    );
    drawTextLeft(
      "El servicio concluyó satisfactoriamente; aún no se ha registrado comentario de reseña.",
      scopeX + 14,
      revY + 74,
      9.5,
      false,
      "0.392 0.455 0.545"
    );
  }

  // -------------------------------------------------------------------------
  // 9. PIE DE PÁGINA CENTRADO DENTRO DE LA TARJETA (y = 42 a 94)
  // -------------------------------------------------------------------------
  stream.appendAscii("0.886 0.910 0.941 RG 0.8 w\n");
  stream.appendAscii(`${cardX} 92 m ${cardX + cardW} 92 l S\n`);

  drawTextCentered(
    "FIXORA  •  Plataforma de Servicios Técnicos Verificados",
    72,
    9,
    true,
    "0.059 0.090 0.165"
  );
  drawTextCentered(
    `Comprobante electrónico oficial  •  Orden ${data.folio}  •  Emitido el ${data.dateText}`,
    57,
    8,
    false,
    "0.392 0.455 0.545"
  );

  // Borde exterior final de la tarjeta principal (#0F172A, 1.8 pt)
  stream.appendAscii("0.059 0.090 0.165 RG 1.8 w\n");
  stream.appendAscii(`${cardX} ${cardBottom} ${cardW} ${cardH} re S\n`);

  // =========================================================================
  // ENSAMBLAJE DE OBJETOS PDF 1.4
  // =========================================================================
  const pdf = new PdfByteBuilder();
  pdf.appendAscii("%PDF-1.4\n");

  const offsets: number[] = [0];
  const xObjectRefs: string[] = [];
  if (data.emblemImg) xObjectRefs.push("/Im1 7 0 R");
  if (data.wordmarkImg)
    xObjectRefs.push(`/Im2 ${data.emblemImg ? 8 : 7} 0 R`);

  const xObjectDict =
    xObjectRefs.length > 0 ? `/XObject << ${xObjectRefs.join(" ")} >>` : "";

  // 1: Catalog
  offsets.push(pdf.length);
  pdf.appendAscii("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  // 2: Pages
  offsets.push(pdf.length);
  pdf.appendAscii("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");

  // 3: Page
  offsets.push(pdf.length);
  pdf.appendAscii(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> ${xObjectDict} >> /Contents 6 0 R >>\nendobj\n`
  );

  // 4: Font Helvetica con WinAnsiEncoding
  offsets.push(pdf.length);
  pdf.appendAscii(
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n"
  );

  // 5: Font Helvetica-Bold con WinAnsiEncoding
  offsets.push(pdf.length);
  pdf.appendAscii(
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n"
  );

  // 6: Content stream
  offsets.push(pdf.length);
  pdf.appendAscii(`6 0 obj\n<< /Length ${stream.length} >>\nstream\n`);
  pdf.appendBytes(new Uint8Array(stream["chunks"].reduce((acc, c) => acc + c.length, 0)));
  // Reemplazamos el bloque anterior escribiendo los chunks directamente:
  // (Se reconstruye abajo de forma limpia sin placeholder)
  return buildFinalPdfFromBuilder(
    offsets,
    stream,
    data.emblemImg,
    data.wordmarkImg
  );
}

function buildFinalPdfFromBuilder(
  _unusedOffsets: number[],
  stream: PdfByteBuilder,
  emblemImg: EmbeddedJpegImage | null,
  wordmarkImg: EmbeddedJpegImage | null
): Blob {
  const pdf = new PdfByteBuilder();
  pdf.appendAscii("%PDF-1.4\n");

  const offsets: number[] = [0];
  const xObjectRefs: string[] = [];
  if (emblemImg) xObjectRefs.push("/Im1 7 0 R");
  if (wordmarkImg) xObjectRefs.push(`/Im2 ${emblemImg ? 8 : 7} 0 R`);

  const xObjectDict =
    xObjectRefs.length > 0 ? `/XObject << ${xObjectRefs.join(" ")} >>` : "";

  // 1: Catalog
  offsets.push(pdf.length);
  pdf.appendAscii("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  // 2: Pages
  offsets.push(pdf.length);
  pdf.appendAscii("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");

  // 3: Page
  offsets.push(pdf.length);
  pdf.appendAscii(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> ${xObjectDict} >> /Contents 6 0 R >>\nendobj\n`
  );

  // 4: Font Helvetica
  offsets.push(pdf.length);
  pdf.appendAscii(
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n"
  );

  // 5: Font Helvetica-Bold
  offsets.push(pdf.length);
  pdf.appendAscii(
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n"
  );

  // 6: Content stream
  offsets.push(pdf.length);
  pdf.appendAscii(`6 0 obj\n<< /Length ${stream.length} >>\nstream\n`);
  // Volcamos los bytes reales de `stream`
  const streamMerged = new Uint8Array(stream.length);
  let ptr = 0;
  for (const chunk of (stream as unknown as { chunks: Uint8Array[] }).chunks) {
    streamMerged.set(chunk, ptr);
    ptr += chunk.length;
  }
  pdf.appendBytes(streamMerged);
  pdf.appendAscii("\nendstream\nendobj\n");

  // 7 / 8: Imágenes JPEG embebidas
  const appendJpegObject = (img: EmbeddedJpegImage) => {
    offsets.push(pdf.length);
    const objId = offsets.length - 1;
    pdf.appendAscii(
      `${objId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.bytes.length} >>\nstream\n`
    );
    pdf.appendBytes(img.bytes);
    pdf.appendAscii("\nendstream\nendobj\n");
  };

  if (emblemImg) appendJpegObject(emblemImg);
  if (wordmarkImg) appendJpegObject(wordmarkImg);

  const xrefStart = pdf.length;
  pdf.appendAscii(`xref\n0 ${offsets.length}\n`);
  pdf.appendAscii("0000000000 65535 f \n");
  for (let i = 1; i < offsets.length; i += 1) {
    pdf.appendAscii(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  }

  pdf.appendAscii(
    `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`
  );

  return pdf.toBlob();
}

export function ServiceReceiptModal({
  order,
  onClose,
}: ServiceReceiptModalProps) {
  const [downloading, setDownloading] = useState(false);

  const pricing = useMemo(() => {
    if (!order) return { amount: null, sourceLabel: "" };
    return extractAgreedAmount(order);
  }, [order]);

  if (!order) return null;

  const folio = `FX-${String(order.id).padStart(4, "0")}`;
  const clientName = order.client?.name ?? "Cliente Fixora";
  const clientPhone = order.client?.phone ?? "No registrado";
  const techName =
    order.technician_profile?.user?.name ??
    order.technician?.name ??
    "Especialista Fixora";
  const techPhone =
    order.technician_profile?.user?.phone ??
    order.technician?.phone ??
    "Verificado en plataforma";
  const specialtyName =
    order.specialty?.name ??
    order.technician_profile?.headline ??
    "Servicio Técnico";
  const locationText =
    order.address_line ||
    order.address ||
    order.approx_zone ||
    order.technician_profile?.service_zone ||
    "Zona local";

  const dateText = order.completed_at
    ? new Date(order.completed_at).toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : order.preferred_date?.slice(0, 10) || "Fecha de cierre";

  const scheduledText = `${order.preferred_date?.slice(0, 10) ?? "—"} ${
    order.preferred_start?.slice(0, 5) ||
    order.preferred_time?.slice(0, 5) ||
    ""
  }`.trim();

  const priceFormatted =
    pricing.amount !== null
      ? `$${pricing.amount.toLocaleString("es-MX", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} MXN`
      : "A CONVENIR";

  const handleDownloadPdf = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const [emblemImg, wordmarkImg] = await Promise.all([
        loadImageAsJpeg(techLogoImg, "#FFFFFF"),
        loadImageAsJpeg(fixoraWordmarkImg, "#FFFFFF"),
      ]);

      const blob = buildStyledFixoraPdfBlob({
        folio,
        orderId: order.id,
        dateText,
        clientName,
        clientPhone,
        techName,
        techPhone,
        specialtyName,
        title: order.title,
        description: order.description,
        packageTitle: order.technician_service?.title ?? null,
        locationText,
        scheduledText,
        priceFormatted,
        priceSourceLabel: pricing.sourceLabel,
        review: order.review,
        emblemImg,
        wordmarkImg,
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Comprobante-${folio}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } finally {
      setDownloading(false);
    }
  };

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Comprobante de orden ${folio}`}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-xs overflow-y-auto print:static print:p-0 print:bg-white print:block"
      onClick={onClose}
    >
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #fixora-receipt-printable,
          #fixora-receipt-printable * {
            visibility: visible;
          }
          #fixora-receipt-printable {
            position: fixed;
            inset: 0;
            width: 100%;
            max-width: 100%;
            margin: 0;
            padding: 24px;
            box-shadow: none !important;
            border: 2px solid #0F172A !important;
            background: #FFFFFF !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div
        id="fixora-receipt-printable"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-[#F8FAFC] border-2 border-[#0F172A] shadow-[8px_8px_0px_#0F172A] rounded-2xl overflow-hidden my-6"
      >
        {/* Cabecera blanca con logos centrados */}
        <div className="relative bg-white px-5 sm:px-7 py-4 border-b border-slate-200 flex items-center justify-center">
          <div className="flex items-center justify-center gap-3">
            <img
              src={techLogoImg}
              alt="Emblema Fixora"
              className="h-11 sm:h-12 w-auto object-contain"
            />
            <img
              src={fixoraWordmarkImg}
              alt="Fixora"
              className="h-8 sm:h-9 w-auto object-contain"
            />
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar comprobante"
            className="no-print absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-[#0F172A] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra superior azul marino centrada */}
        <div className="bg-[#0B1120] text-white px-5 sm:px-7 py-5 text-center">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="font-mono text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded bg-[#1D63ED] text-white">
              FIXORA • COMPROBANTE OFICIAL
            </span>
            <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-300">
              SERVICIO FINALIZADO
            </span>
          </div>
          <h2 className="mt-3 font-mono text-2xl sm:text-3xl font-black tracking-tight">
            ORDEN DE SERVICIO {folio}
          </h2>
          <p className="font-mono text-xs text-slate-300 mt-1">
            Emisión: {dateText} • Folio de control: #{order.id}
          </p>
        </div>

        {/* Franja de precaución */}
        <div
          className="h-2.5 w-full border-y border-[#0F172A]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, #FACC15 0px, #FACC15 10px, #0F172A 10px, #0F172A 20px)",
          }}
        />

        {/* Cuerpo tipo ticket punteado */}
        <div className="p-5 sm:p-7 space-y-5 bg-white m-3 sm:m-5 rounded-xl border-2 border-dashed border-slate-400">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-dashed border-slate-300">
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-1">
              <p className="font-mono text-[11px] font-bold uppercase text-slate-500 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#1D63ED]" />
                Datos del Cliente
              </p>
              <p className="text-sm font-extrabold text-[#0F172A]">
                {clientName}
              </p>
              <p className="font-mono text-xs text-slate-600">
                Tel: {clientPhone}
              </p>
            </div>

            <div className="rounded-xl bg-blue-50/50 border border-blue-200 p-3.5 space-y-1">
              <p className="font-mono text-[11px] font-bold uppercase text-[#1D63ED] flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5" />
                Técnico Especialista
              </p>
              <p className="text-sm font-extrabold text-[#0F172A] flex items-center gap-1.5">
                {techName}
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              </p>
              <p className="font-mono text-xs text-slate-600">
                {specialtyName} • Tel: {techPhone}
              </p>
            </div>
          </div>

          <div className="space-y-2.5 pb-4 border-b border-dashed border-slate-300">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-xs font-bold uppercase text-slate-500">
                Alcance del Servicio Acordado
              </span>
              <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-blue-50 text-[#1D63ED]">
                {specialtyName}
              </span>
            </div>

            <h3 className="text-base font-extrabold text-[#0F172A]">
              {order.title}
            </h3>
            <p className="text-sm text-slate-700 leading-relaxed">
              {order.description}
            </p>

            {order.technician_service?.title && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-900">
                Paquete / Servicio base: {order.technician_service.title}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-xs text-slate-600">
              <p className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#1D63ED] shrink-0" />
                <span className="truncate">Ubicación: {locationText}</span>
              </p>
              <p className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#1D63ED] shrink-0" />
                <span>Programado: {scheduledText}</span>
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-[#0B1120] text-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-wider text-blue-300">
                Cotización / Precio del Servicio
              </p>
              <p className="text-xs text-slate-300 mt-0.5">
                {pricing.sourceLabel}
              </p>
            </div>
            <div className="font-mono text-2xl font-black text-[#FACC15]">
              {priceFormatted}
            </div>
          </div>

          <div className="rounded-xl bg-amber-50/70 border border-amber-200 p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs font-bold uppercase text-amber-950 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Calificación y Reseña
              </span>
              {order.review ? (
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-4 h-4 ${
                        star <= order.review!.rating
                          ? "fill-amber-400 text-amber-400"
                          : "text-slate-300"
                      }`}
                    />
                  ))}
                  <span className="ml-1 font-mono text-xs font-extrabold text-[#0F172A]">
                    {order.review.rating}/5
                  </span>
                </div>
              ) : (
                <span className="font-mono text-xs text-amber-800">
                  Pendiente de calificación
                </span>
              )}
            </div>

            {order.review?.comment ? (
              <p className="text-xs sm:text-sm text-slate-700 italic">
                "{order.review.comment}"
              </p>
            ) : (
              <p className="text-xs text-slate-500">
                {order.review
                  ? "Calificación registrada sin comentario adicional."
                  : "El servicio concluyó satisfactoriamente; aún no se ha registrado comentario de reseña."}
              </p>
            )}

            {order.review?.technician_reply && (
              <div className="pt-2 border-t border-amber-200/80 text-xs text-slate-700">
                <strong className="text-[#1D63ED]">
                  Respuesta del especialista:
                </strong>{" "}
                {order.review.technician_reply}
              </div>
            )}
          </div>
        </div>

        {/* Acciones inferiores */}
        <div className="no-print px-5 sm:px-7 py-4 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={handlePrintPdf}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 hover:bg-slate-50 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Imprimir
          </button>
          <button
            type="button"
            disabled={downloading}
            onClick={() => void handleDownloadPdf()}
            className="inline-flex items-center gap-2 rounded-xl bg-[#1D63ED] px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-60 shadow-xs cursor-pointer"
          >
            <Download className="w-4 h-4" />
            {downloading ? "Generando PDF..." : "Descargar PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ServiceReceiptModal;