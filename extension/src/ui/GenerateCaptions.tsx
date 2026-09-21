import { useState } from 'react';
import { prepareSegments } from '../segmentation';
import { z } from 'zod';
import {
  segmentSchema,
  timestamp,
  type Segment,
  type VideoContext,
} from '@youtube-note/shared';
import { rpc, errorText } from '../lib/rpc';
const ticketSchema = z.object({
  id: z.string(),
  videoId: z.string(),
  durationMs: z.number(),
  credits: z.number(),
  rate: z.number(),
  status: z.string(),
  segments: z.array(segmentSchema).optional(),
});
type Ticket = z.infer<typeof ticketSchema>;
export function GenerateCaptions({
  context,
  tabId,
  onReady,
}: {
  context: VideoContext;
  tabId?: number;
  onReady: (segments: Segment[]) => Promise<void>;
}) {
  const [ticket, setTicket] = useState<Ticket | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function action(
    operation: 'prepareGeneration' | 'confirmGeneration' | 'job',
  ) {
    setBusy(true);
    setError('');
    try {
      const result = ticketSchema.parse(
        await rpc({
          type: 'native',
          tabId,
          operation,
          payload: {
            videoId: context.videoId,
            durationMs: context.durationMs,
            id: ticket?.id,
            confirmed: operation === 'confirmGeneration',
          },
        }),
      );
      setTicket(result);
      if (result.status === 'completed' && result.segments) {
        await onReady(prepareSegments(result.segments));
        setTicket(null);
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="card">
      <p>没有可用字幕？可通过字幕服务生成。</p>
      <button disabled={busy} onClick={() => void action('prepareGeneration')}>
        查看生成消耗
      </button>
      {error && <p role="alert">{error}</p>}
      {ticket && (
        <div>
          <p>
            视频时长：{timestamp(ticket.durationMs)}
            <br />
            预计：{ticket.credits} credits
            <br />
            估算依据：按整分钟向上取整 × {ticket.rate}{' '}
            credits/分钟。实际扣费以服务商为准。
          </p>
          {ticket.status === 'awaiting' ? (
            <div className="row">
              <button onClick={() => setTicket(null)}>取消</button>
              <button
                className="primary"
                disabled={busy}
                onClick={() => void action('confirmGeneration')}
              >
                确认生成本视频字幕
              </button>
            </div>
          ) : ticket.status === 'running' ? (
            <>
              <p>字幕正在生成，可稍后检查进度。关闭此窗口不会再次提交。</p>
              <button disabled={busy} onClick={() => void action('job')}>
                检查生成进度
              </button>
            </>
          ) : (
            <p>
              任务状态：
              {(
                {
                  unknown: '提交结果未知，请到服务后台核对',
                  submitting: '正在提交，请稍后检查',
                  failed: '生成失败，请到服务后台核对',
                  completed: '已完成',
                } as Record<string, string>
              )[ticket.status] ?? ticket.status}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
