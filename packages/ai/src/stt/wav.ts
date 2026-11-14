/** Taille de l'en-tête WAV (RIFF + fmt PCM + data). */
export const WAV_HEADER_BYTES = 44;

export interface PcmFormat {
  sampleRate: number;
  channels: number;
}

/** Durée (s) d'un son PCM 16 bits. */
export function pcm16DurationSec(byteLength: number, format: PcmFormat): number {
  return byteLength / (2 * format.channels * format.sampleRate);
}

/**
 * Fichier WAV (PCM 16 bits little-endian) à partir de morceaux de son bruts, sans copie
 * intermédiaire. Un octet orphelin en fin de son (échantillon incomplet) est ignoré.
 */
export function pcm16ToWav(chunks: readonly Uint8Array[], format: PcmFormat): Uint8Array {
  const blockAlign = 2 * format.channels;
  const total = chunks.reduce((n, c) => n + c.byteLength, 0);
  const dataBytes = total - (total % blockAlign);
  const out = new Uint8Array(WAV_HEADER_BYTES + dataBytes);
  const view = new DataView(out.buffer);
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  ascii(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true); // taille du bloc fmt
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, format.channels, true);
  view.setUint32(24, format.sampleRate, true);
  view.setUint32(28, format.sampleRate * blockAlign, true); // octets par seconde
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bits par échantillon
  ascii(36, 'data');
  view.setUint32(40, dataBytes, true);

  let offset = WAV_HEADER_BYTES;
  for (const chunk of chunks) {
    const room = out.byteLength - offset;
    if (room <= 0) break;
    const part = chunk.byteLength > room ? chunk.subarray(0, room) : chunk;
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}
