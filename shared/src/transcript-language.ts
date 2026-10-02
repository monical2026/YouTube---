import type { Segment, Mode } from './index';
export function transcriptLanguage(segments: Segment[]): string {
  const declared = segments.find((s) => s.sourceLanguage)?.sourceLanguage;
  if (declared) return declared.replace(/^ai-/, '').toLowerCase().split('-')[0];
  const sample = segments
    .slice(0, 30)
    .map((s) => s.original)
    .join('')
    .slice(0, 4000);
  const han = sample.match(/[\u3400-\u9fff]/g)?.length ?? 0;
  // 旧记录没有语言字段；仅将中文占明显多数的原稿识别为中文。
  if (han > 20 && han > sample.replace(/\s/g, '').length * 0.4) return 'zh';
  return 'en';
}
export function readingMode(segments: Segment[], mode: Mode): Mode {
  return transcriptLanguage(segments) === 'zh' ? 'original' : mode;
}
