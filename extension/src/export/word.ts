import { escapeXml, type Block } from './document';
// 使用无压缩 ZIP 打包最小 OOXML 文档，无远程转换和新增运行时依赖。
export function wordDocument(blocks: Block[]): Uint8Array<ArrayBuffer> {
  const paragraphs = blocks
    .flatMap((b) =>
      b.text
        .split('\n')
        .map(
          (line) =>
            `<w:p><w:r><w:rPr>${b.heading ? '<w:b/>' : ''}<w:sz w:val="${b.heading ? 30 : 24}"/></w:rPr><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`,
        ),
    )
    .join('');
  return zipFiles({
    '[Content_Types].xml':
      '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    '_rels/.rels':
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/document.xml': `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1020" w:right="1020" w:bottom="1020" w:left="1020"/></w:sectPr></w:body></w:document>`,
  });
}
function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function zipFiles(files: Record<string, string>): Uint8Array<ArrayBuffer> {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [],
    directory: Uint8Array[] = [];
  let offset = 0,
    centralSize = 0;
  for (const [path, text] of Object.entries(files)) {
    const name = enc.encode(path),
      data = enc.encode(text),
      crc = crc32(data);
    const local = new Uint8Array(30 + name.length),
      lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x800, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);
    const central = new Uint8Array(46 + name.length),
      cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x800, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    central.set(name, 46);
    chunks.push(local, data);
    directory.push(central);
    offset += local.length + data.length;
    centralSize += central.length;
  }
  const end = new Uint8Array(22),
    ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, directory.length, true);
  ev.setUint16(10, directory.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  const result = new Uint8Array(offset + centralSize + 22);
  let at = 0;
  for (const chunk of [...chunks, ...directory, end]) {
    result.set(chunk, at);
    at += chunk.length;
  }
  return result;
}
