export interface ExcelSheetPreview {
  name: string;
  rows: any[][];
  totalRows: number;
  totalCols: number;
}

export interface DocxBlock {
  type: 'h1' | 'h2' | 'h3' | 'p' | 'li' | 'table';
  text?: string;
  align?: 'left' | 'center' | 'right' | 'justify';
  bold?: boolean;
  tableRows?: string[][];
}

export interface PptxSlide {
  slideNum: number;
  texts: string[];
}

export const getBytesFromUrl = async (url: string): Promise<Uint8Array> => {
  if (url.startsWith('blob:') || url.startsWith('http:') || url.startsWith('https:')) {
    const res = await fetch(url);
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  }
  const parts = url.split(',');
  const base64 = parts[1] || parts[0];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

export const decodeDataUrlText = async (dataUrl: string): Promise<string> => {
  try {
    if (dataUrl.startsWith('blob:') || dataUrl.startsWith('http:') || dataUrl.startsWith('https:')) {
      const res = await fetch(dataUrl);
      return await res.text();
    }
    const base64 = dataUrl.split(',')[1];
    if (!base64) return '';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(bytes);
  } catch {
    return 'Không thể giải mã văn bản.';
  }
};

export const dataUrlToBlob = async (url: string): Promise<Blob> => {
  if (url.startsWith('blob:')) {
    const res = await fetch(url);
    return await res.blob();
  }
  const parts = url.split(',');
  const mime = parts[0]?.match(/:(.*?);/)?.[1] || 'application/octet-stream';
  const base64 = parts[1] || parts[0];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
};

export const parseExcelFromDataUrl = async (
  dataUrl: string
): Promise<{ sheets: ExcelSheetPreview[]; activeSheetIndex: number } | null> => {
  try {
    const bytes = await getBytesFromUrl(dataUrl);
    const XLSX = await import('xlsx-js-style');
    const workbook = XLSX.read(bytes, { type: 'array' });
    const sheets: ExcelSheetPreview[] = workbook.SheetNames.map((name) => {
      const sheet = workbook.Sheets[name];
      const rawData = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });
      let maxCols = 0;
      rawData.forEach((row) => {
        if (Array.isArray(row) && row.length > maxCols) maxCols = row.length;
      });
      return {
        name,
        rows: rawData.slice(0, 300),
        totalRows: rawData.length,
        totalCols: maxCols,
      };
    });
    return { sheets, activeSheetIndex: 0 };
  } catch (err) {
    console.error('Lỗi khi đọc bảng tính Excel:', err);
    return null;
  }
};

export const parseDocxFromDataUrl = async (dataUrl: string): Promise<DocxBlock[] | null> => {
  try {
    const buf = await getBytesFromUrl(dataUrl);
    const view = new DataView(buf.buffer as ArrayBuffer, buf.byteOffset, buf.byteLength);
    let offset = 0;
    let docXmlText: string | null = null;
    while (offset < buf.byteLength - 4) {
      const sig = view.getUint32(offset, true);
      if (sig !== 0x04034b50) break;
      const compMethod = view.getUint16(offset + 8, true);
      const compSize = view.getUint32(offset + 18, true);
      const nameLen = view.getUint16(offset + 26, true);
      const extraLen = view.getUint16(offset + 28, true);
      const name = new TextDecoder().decode(buf.subarray(offset + 30, offset + 30 + nameLen));
      const dataStart = offset + 30 + nameLen + extraLen;
      const compData = buf.subarray(dataStart, dataStart + compSize);

      if (name === 'word/document.xml') {
        if (compMethod === 0) {
          docXmlText = new TextDecoder().decode(compData);
        } else if (compMethod === 8) {
          const ds = new DecompressionStream('deflate-raw');
          const writer = ds.writable.getWriter();
          writer.write(compData as any);
          writer.close();
          const res = new Response(ds.readable);
          docXmlText = await res.text();
        }
        break;
      }
      offset = dataStart + compSize;
    }

    if (!docXmlText) return null;

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(docXmlText, 'application/xml');
    const body = xmlDoc.getElementsByTagName('w:body')[0];
    if (!body) return null;

    const blocks: DocxBlock[] = [];
    const children = Array.from(body.children);

    for (const child of children) {
      if (child.nodeName === 'w:p') {
        const textNodes = child.getElementsByTagName('w:t');
        let fullText = '';
        for (let i = 0; i < textNodes.length; i++) {
          fullText += textNodes[i].textContent || '';
        }
        if (!fullText.trim()) continue;

        const jcEl = child.getElementsByTagName('w:jc')[0];
        const jcVal = jcEl?.getAttribute('w:val') || '';
        let align: 'left' | 'center' | 'right' | 'justify' = 'left';
        if (jcVal === 'center') align = 'center';
        else if (jcVal === 'right') align = 'right';
        else if (jcVal === 'both' || jcVal === 'distribute') align = 'justify';

        const hasBold = child.getElementsByTagName('w:b').length > 0;
        const pStyle = child.getElementsByTagName('w:pStyle')[0]?.getAttribute('w:val') || '';
        const numPr = child.getElementsByTagName('w:numPr')[0];

        if (pStyle.toLowerCase().includes('heading1') || pStyle === '1') {
          blocks.push({ type: 'h1', text: fullText, align });
        } else if (pStyle.toLowerCase().includes('heading2') || pStyle === '2') {
          blocks.push({ type: 'h2', text: fullText, align });
        } else if (pStyle.toLowerCase().includes('heading3') || pStyle === '3') {
          blocks.push({ type: 'h3', text: fullText, align });
        } else if (numPr) {
          blocks.push({ type: 'li', text: fullText, align });
        } else {
          blocks.push({ type: 'p', text: fullText, align, bold: hasBold });
        }
      } else if (child.nodeName === 'w:tbl') {
        const trList = child.getElementsByTagName('w:tr');
        const tableRows: string[][] = [];
        for (let r = 0; r < trList.length; r++) {
          const tcList = trList[r].getElementsByTagName('w:tc');
          const rowCells: string[] = [];
          for (let c = 0; c < tcList.length; c++) {
            const tNodes = tcList[c].getElementsByTagName('w:t');
            let cellText = '';
            for (let k = 0; k < tNodes.length; k++) {
              cellText += tNodes[k].textContent || '';
            }
            rowCells.push(cellText);
          }
          if (rowCells.length > 0) tableRows.push(rowCells);
        }
        if (tableRows.length > 0) {
          blocks.push({ type: 'table', tableRows });
        }
      }
    }

    return blocks.length > 0 ? blocks : null;
  } catch (e) {
    console.error('Lỗi khi đọc file docx:', e);
    return null;
  }
};

export const parsePptxFromDataUrl = async (dataUrl: string): Promise<PptxSlide[] | null> => {
  try {
    const buf = await getBytesFromUrl(dataUrl);
    const view = new DataView(buf.buffer as ArrayBuffer, buf.byteOffset, buf.byteLength);
    let offset = 0;
    const slideXmlMap: Record<number, string> = {};

    while (offset < buf.byteLength - 4) {
      const sig = view.getUint32(offset, true);
      if (sig !== 0x04034b50) break;
      const compMethod = view.getUint16(offset + 8, true);
      const compSize = view.getUint32(offset + 18, true);
      const nameLen = view.getUint16(offset + 26, true);
      const extraLen = view.getUint16(offset + 28, true);
      const name = new TextDecoder().decode(buf.subarray(offset + 30, offset + 30 + nameLen));
      const dataStart = offset + 30 + nameLen + extraLen;
      const compData = buf.subarray(dataStart, dataStart + compSize);

      const slideMatch = name.match(/ppt\/slides\/slide(\d+)\.xml/);
      if (slideMatch) {
        const slideNum = parseInt(slideMatch[1], 10);
        if (compMethod === 0) {
          slideXmlMap[slideNum] = new TextDecoder().decode(compData);
        } else if (compMethod === 8) {
          const ds = new DecompressionStream('deflate-raw');
          const writer = ds.writable.getWriter();
          writer.write(compData as any);
          writer.close();
          const res = new Response(ds.readable);
          slideXmlMap[slideNum] = await res.text();
        }
      }
      offset = dataStart + compSize;
    }

    const parser = new DOMParser();
    const slides: PptxSlide[] = [];
    const slideNumbers = Object.keys(slideXmlMap).map(Number).sort((a, b) => a - b);

    for (const num of slideNumbers) {
      const xmlStr = slideXmlMap[num];
      const xmlDoc = parser.parseFromString(xmlStr, 'application/xml');
      const tNodes = xmlDoc.getElementsByTagName('a:t');
      const texts: string[] = [];
      for (let i = 0; i < tNodes.length; i++) {
        const txt = (tNodes[i].textContent || '').trim();
        if (txt) texts.push(txt);
      }
      if (texts.length > 0) {
        slides.push({ slideNum: num, texts });
      }
    }

    return slides.length > 0 ? slides : null;
  } catch (e) {
    console.error('Lỗi khi đọc file pptx:', e);
    return null;
  }
};
