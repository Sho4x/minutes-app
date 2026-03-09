'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import type { Session, Organization, Talk, Member } from '@/types';
import { sessionsStore, organizationsStore, talksStore } from '@/lib/db';

// ── Helpers ─────────────────────────────────────────────────────────

function formatDatetime(iso: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('ja-JP', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', weekday: 'long',
  });
}

function getMemberName(member: Member): string {
  return member.lastName + (member.firstName ? ` ${member.firstName}` : '');
}

const ROLE_LABEL: Record<string, string> = {
  chair: '議長', vice: '副議長', exec: '役員', member: '',
};

// ── Page ─────────────────────────────────────────────────────────────

export default function OutputPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const router = useRouter();

  const [session, setSession] = useState<Session | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  // agendaId → Talk[]
  const [talkMap, setTalkMap] = useState<Map<string, Talk[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // ── Load ────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      const s = await sessionsStore.getById(sessionId);
      if (!s) { router.push('/'); return; }
      setSession(s);
      const o = await organizationsStore.getById(s.organizationId);
      setOrganization(o ?? null);

      const allTalks = await talksStore.getAll();
      const agendaIds = new Set(s.agendas.map(a => a.id));
      const filtered = allTalks.filter(t => agendaIds.has(t.agendaId));

      const map = new Map<string, Talk[]>();
      for (const a of s.agendas) map.set(a.id, []);
      for (const t of filtered) {
        const list = map.get(t.agendaId);
        if (list) list.push(t);
      }
      // Sort each agenda's talks by savedAt
      for (const [, list] of map) {
        list.sort((a, b) => a.savedAt.localeCompare(b.savedAt));
      }
      setTalkMap(map);
      setLoading(false);
    })();
  }, [sessionId, router]);

  // ── PDF export ──────────────────────────────────────────────────

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      // Dynamic import to avoid SSR issues
      const html2pdf = (await import('html2pdf.js')).default;
      const element = document.getElementById('minutes-preview');
      if (!element) return;

      const filename = session
        ? `${session.title}_議事録.pdf`
        : '議事録.pdf';

      // pagebreak は型定義に含まれないため any でキャスト
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const opts: any = {
        margin: [15, 15, 15, 15],
        filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
      };
      await html2pdf().set(opts).from(element).save();
    } catch (err) {
      console.error('PDF export error:', err);
    } finally {
      setExporting(false);
    }
  };

  // ── Derived stats ───────────────────────────────────────────────

  const totalTalks = Array.from(talkMap.values()).reduce((sum, list) => sum + list.length, 0);
  const memberCount = session?.members.length ?? 0;
  const agendaCount = session?.agendas.length ?? 0;
  const chair = session?.members.find(m => m.role === 'chair');
  const vice = session?.members.find(m => m.role === 'vice');

  // ── Loading ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <p className="text-zinc-500 text-sm">読み込み中...</p>
      </div>
    );
  }
  if (!session) return null;

  // ── Render ──────────────────────────────────────────────────────

  return (
    <>
      {/* @media print: hide sidebar */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-full { width: 100% !important; }
        }
      `}</style>

      <div className="min-h-screen bg-[#0f0f0f] text-white flex">

        {/* ── Left pane: 議事録プレビュー (2/3) ── */}
        <main className="flex-1 overflow-y-auto px-8 py-10 print-full">
          {/*
            id="minutes-preview" — html2pdf.js のターゲット。
            日本語文字化け防止のため、テキストはすべて inline style で黒指定。
          */}
          <div
            id="minutes-preview"
            style={{
              fontFamily: '"Noto Sans JP", "Hiragino Sans", "Yu Gothic", sans-serif',
              color: '#111111',
              backgroundColor: '#ffffff',
              padding: '32px',
              borderRadius: '8px',
              lineHeight: '1.8',
            }}
          >
            {/* ── 表紙ヘッダー ── */}
            <div style={{ borderBottom: '2px solid #1d4ed8', paddingBottom: '16px', marginBottom: '24px' }}>
              {organization && (
                <p style={{ color: '#4b5563', fontSize: '13px', marginBottom: '4px' }}>
                  {organization.name}{organization.groupName ? ` / ${organization.groupName}` : ''}
                </p>
              )}
              <h1 style={{ fontSize: '22px', fontWeight: 'bold', color: '#111827', margin: '0 0 12px' }}>
                議事録：{session.title}
              </h1>

              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '13px', color: '#374151' }}>
                <tbody>
                  {session.datetime && (
                    <tr>
                      <td style={{ padding: '3px 12px 3px 0', fontWeight: '600', whiteSpace: 'nowrap', color: '#6b7280' }}>日時</td>
                      <td style={{ padding: '3px 0', color: '#111827' }}>{formatDatetime(session.datetime)}</td>
                    </tr>
                  )}
                  {session.location && (
                    <tr>
                      <td style={{ padding: '3px 12px 3px 0', fontWeight: '600', whiteSpace: 'nowrap', color: '#6b7280' }}>場所</td>
                      <td style={{ padding: '3px 0', color: '#111827' }}>{session.location}</td>
                    </tr>
                  )}
                  {chair && (
                    <tr>
                      <td style={{ padding: '3px 12px 3px 0', fontWeight: '600', whiteSpace: 'nowrap', color: '#6b7280' }}>議長</td>
                      <td style={{ padding: '3px 0', color: '#111827' }}>{getMemberName(chair)}</td>
                    </tr>
                  )}
                  {vice && (
                    <tr>
                      <td style={{ padding: '3px 12px 3px 0', fontWeight: '600', whiteSpace: 'nowrap', color: '#6b7280' }}>副議長</td>
                      <td style={{ padding: '3px 0', color: '#111827' }}>{getMemberName(vice)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* ── 出席者一覧 ── */}
            <section style={{ marginBottom: '28px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 'bold', color: '#1d4ed8', borderLeft: '4px solid #1d4ed8', paddingLeft: '10px', marginBottom: '10px' }}>
                出席者
              </h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
                {session.members.map(m => {
                  const label = ROLE_LABEL[m.role];
                  return (
                    <span key={m.id} style={{ fontSize: '13px', color: '#374151' }}>
                      {getMemberName(m)}
                      {label && (
                        <span style={{ marginLeft: '4px', fontSize: '11px', color: '#6b7280' }}>
                          ({label})
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>
            </section>

            {/* ── 議題と発言 ── */}
            {session.agendas.map((agenda, agendaIdx) => {
              const agendaTalks = talkMap.get(agenda.id) ?? [];
              return (
                <section key={agenda.id} style={{ marginBottom: '28px' }}>
                  <h2 style={{ fontSize: '15px', fontWeight: 'bold', color: '#1d4ed8', borderLeft: '4px solid #1d4ed8', paddingLeft: '10px', marginBottom: '12px' }}>
                    議題 {agendaIdx + 1}：{agenda.title}
                  </h2>
                  {agendaTalks.length === 0 ? (
                    <p style={{ color: '#9ca3af', fontSize: '13px', fontStyle: 'italic' }}>発言記録なし</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {agendaTalks.map(talk => {
                        const member = session.members.find(m => m.id === talk.speakerId);
                        const speakerName = member ? getMemberName(member) : '不明';
                        return (
                          <div key={talk.id} style={{ display: 'flex', gap: '12px', fontSize: '13px', color: '#111827' }}>
                            <span style={{ fontWeight: '600', whiteSpace: 'nowrap', minWidth: '80px', color: '#374151' }}>
                              {speakerName}：
                            </span>
                            <span style={{ whiteSpace: 'pre-wrap', flex: 1, color: '#111827' }}>
                              {talk.text}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}

            {/* ── フッター ── */}
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '12px', marginTop: '16px', fontSize: '11px', color: '#9ca3af', textAlign: 'right' }}>
              作成日：{new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
        </main>

        {/* ── Right pane: 操作パネル (1/3) ── */}
        <aside className="no-print w-80 flex-shrink-0 border-l border-zinc-800 bg-zinc-950 px-6 py-8 flex flex-col gap-6 overflow-y-auto">

          {/* ボタン群 */}
          <div className="flex flex-col gap-3">
            <button
              onClick={handleExportPdf}
              disabled={exporting}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl transition-colors text-sm"
            >
              {exporting ? 'PDF生成中...' : '📄 PDFで出力'}
            </button>
            <button
              onClick={() => router.push('/')}
              className="w-full border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white font-medium py-3 rounded-xl transition-colors text-sm"
            >
              ← ホームへ戻る
            </button>
          </div>

          {/* 統計情報 */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">統計情報</h3>
            <ul className="space-y-3">
              <StatRow label="出席者数" value={`${memberCount} 名`} />
              <StatRow label="議題数" value={`${agendaCount} 件`} />
              <StatRow label="発言数" value={`${totalTalks} 件`} />
              {session.datetime && (
                <StatRow
                  label="開催日"
                  value={new Date(session.datetime).toLocaleDateString('ja-JP', {
                    month: 'long', day: 'numeric',
                  })}
                />
              )}
              {session.location && (
                <StatRow label="場所" value={session.location} />
              )}
            </ul>
          </div>

          {/* 出席者内訳 */}
          {session.members.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">出席者</h3>
              <ul className="space-y-2">
                {session.members.map(m => {
                  const label = ROLE_LABEL[m.role];
                  return (
                    <li key={m.id} className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                        style={{ backgroundColor: m.avatarColor }}
                      >
                        {m.lastName[0]}
                      </div>
                      <span className="text-sm text-zinc-200 flex-1 truncate">{getMemberName(m)}</span>
                      {label && (
                        <span className="text-xs text-zinc-500 flex-shrink-0">{label}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* 議題サマリー */}
          {session.agendas.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">議題</h3>
              <ol className="space-y-2">
                {session.agendas.map((a, i) => {
                  const count = talkMap.get(a.id)?.length ?? 0;
                  return (
                    <li key={a.id} className="flex gap-2 text-sm">
                      <span className="text-zinc-600 font-mono flex-shrink-0">{i + 1}.</span>
                      <span className="text-zinc-300 flex-1 min-w-0 truncate">{a.title}</span>
                      <span className="text-zinc-600 flex-shrink-0 text-xs">{count}件</span>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

// ── Sub-components ─────────────────────────────────────────────────

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex justify-between items-center">
      <span className="text-sm text-zinc-500">{label}</span>
      <span className="text-sm text-zinc-100 font-medium">{value}</span>
    </li>
  );
}
