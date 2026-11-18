import React, { useState } from 'react';
import {
  CheckCircle2,
  Cloud,
  Crosshair,
  Lock,
  RefreshCw,
  Shield,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import type { CloudHubSyncStatus } from '../../services/localAuth';
import type { GameRole, TeamRole } from '../../types/training';

export interface AuthModalSubmitPayload {
  mode: 'login' | 'register';
  identifier: string;
  password: string;
  displayName?: string;
  riotId?: string;
  teamRole?: TeamRole;
  gameRole?: GameRole;
  mainAgent?: string;
  managerIdentifier?: string;
  managerPassword?: string;
  useCloudSync: boolean;
}

interface AuthModalProps {
  open: boolean;
  fullPage?: boolean;
  busy: boolean;
  error: string;
  cloudSyncStatus?: CloudHubSyncStatus;
  onForceCloudSync?: () => Promise<void>;
  savedAccounts: Array<{
    uid: string;
    identifier: string;
    displayName: string;
    riotId: string;
    teamRole?: TeamRole;
    isAdmin?: boolean;
    managedBy?: string;
    managedByName?: string;
  }>;
  onClose?: () => void;
  onClearError: () => void;
  onSubmit: (payload: AuthModalSubmitPayload) => Promise<void>;
}

export function AuthModal({
  open,
  fullPage = false,
  busy,
  error,
  cloudSyncStatus,
  onForceCloudSync,
  savedAccounts,
  onClose,
  onClearError,
  onSubmit,
}: AuthModalProps) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [syncingNow, setSyncingNow] = useState(false);

  if (!open) return null;

  const managerAccounts = savedAccounts.filter(
    (a) => a.teamRole === 'coach' || a.isAdmin,
  );
  const playerAccounts = savedAccounts.filter(
    (a) => a.teamRole !== 'coach' && !a.isAdmin,
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      mode: 'login',
      identifier,
      password,
      useCloudSync: false,
    });
  };

  const handleManualSync = async () => {
    if (!onForceCloudSync || syncingNow) return;
    setSyncingNow(true);
    try {
      await onForceCloudSync();
    } finally {
      setSyncingNow(false);
    }
  };

  const formCard = (
    <div
      role={fullPage ? undefined : 'dialog'}
      aria-modal={fullPage ? undefined : 'true'}
      aria-labelledby="auth-modal-title"
      className="w-full max-w-md bg-[#121621] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
    >
      <div className="px-5 py-4 border-b border-white/[0.07] flex items-center justify-between bg-[#0D1017]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#FF4655]/15 border border-[#FF4655]/40 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-[#FF4655]" />
          </div>
          <div>
            <h2
              id="auth-modal-title"
              className="font-display font-semibold text-base text-white flex items-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5 text-[#FF4655]" />
              <span>Đăng nhập hệ thống</span>
            </h2>
            <p className="text-[11px] text-slate-400">
              Đồng bộ thời gian thực trên mọi máy tính &amp; trình duyệt
            </p>
          </div>
        </div>
        {!fullPage && onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ tài khoản"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
        {/* Live Cross-Device Cloud Sync Status Bar */}
        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Cloud className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <div className="text-[11px] text-emerald-200 truncate">
              <span className="font-semibold">Cloud Database Đồng Nhất</span>
              <span className="mx-1.5 text-emerald-500/60">·</span>
              <span className="font-mono text-emerald-300/90">
                v{cloudSyncStatus?.revision || 1}
                {cloudSyncStatus?.lastSyncedAt ? ` (${cloudSyncStatus.lastSyncedAt})` : ''}
              </span>
            </div>
          </div>
          {onForceCloudSync && (
            <button
              type="button"
              onClick={() => void handleManualSync()}
              disabled={syncingNow}
              className="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-[10px] font-semibold text-emerald-200 flex items-center gap-1 shrink-0 transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${syncingNow ? 'animate-spin' : ''}`} />
              <span>Đồng bộ</span>
            </button>
          )}
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-[#FF4655]/15 border border-[#FF4655]/40 text-xs text-red-200 leading-relaxed">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {managerAccounts.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <Shield className="w-3 h-3 text-[#FF4655]" />
                <span>Tài khoản Ban Huấn Luyện / Manager:</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {managerAccounts.map((acc) => (
                  <button
                    key={acc.uid}
                    type="button"
                    onClick={() => {
                      setIdentifier(acc.identifier);
                      onClearError();
                    }}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs transition-colors ${
                      identifier === acc.identifier
                        ? 'bg-[#FF4655]/20 border-[#FF4655]/60 text-white'
                        : 'bg-[#090B10] hover:bg-white/[0.06] border-white/10 text-slate-200'
                    }`}
                  >
                    <span className="font-mono font-semibold">{acc.identifier}</span> ·{' '}
                    <span className="text-[#FF4655] font-medium">
                      {acc.isAdmin ? 'Admin / Manager' : 'Manager'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {playerAccounts.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <Users className="w-3 h-3 text-sky-400" />
                <span>Tuyển thủ trực thuộc Manager (Đồng bộ thời gian thực):</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {playerAccounts.map((acc) => (
                  <button
                    key={acc.uid}
                    type="button"
                    onClick={() => {
                      setIdentifier(acc.identifier);
                      onClearError();
                    }}
                    className={`px-2.5 py-1 rounded-lg border text-xs transition-colors ${
                      identifier === acc.identifier
                        ? 'bg-sky-500/20 border-sky-400/60 text-white'
                        : 'bg-[#090B10] hover:bg-white/[0.06] border-white/10 text-slate-300'
                    }`}
                  >
                    <span className="font-mono font-semibold">{acc.identifier}</span> ·{' '}
                    <span className="text-sky-400">{acc.riotId}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <label
            htmlFor="auth-identifier"
            className="block text-xs font-medium text-slate-300 mb-1.5"
          >
            Tên đăng nhập *
          </label>
          <input
            id="auth-identifier"
            type="text"
            required
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="VD: noti, binh, hoặc tên đăng nhập tuyển thủ..."
            className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400"
          />
        </div>

        <div>
          <label
            htmlFor="auth-password"
            className="block text-xs font-medium text-slate-300 mb-1.5"
          >
            Mật khẩu *
          </label>
          <input
            id="auth-password"
            type="password"
            required
            minLength={6}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••"
            className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400"
          />
        </div>

        <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[11px] text-slate-400 leading-relaxed">
          Mọi thay đổi từ <strong className="text-slate-200">Manager</strong> (thêm/xóa tuyển thủ, giao nhiệm vụ, lịch Scrim) và <strong className="text-sky-400">Tuyển thủ</strong> đều tự động đồng bộ trực tiếp lên Cloud Firestore cho tất cả máy tính và trình duyệt.
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/[0.07]">
          {!fullPage && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium text-slate-300"
            >
              Đóng
            </button>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full px-5 py-2.5 rounded-lg bg-[#FF4655] hover:bg-[#e53c4a] disabled:opacity-60 text-xs font-semibold text-white transition-colors"
          >
            {busy ? 'Đang đăng nhập...' : 'Đăng nhập vào Hub'}
          </button>
        </div>
      </form>
    </div>
  );

  if (!fullPage) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
        {formCard}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090B10] text-slate-100 flex flex-col justify-between relative overflow-hidden">
      <div
        className="pointer-events-none absolute -top-40 -left-40 w-96 h-96 rounded-full bg-[#FF4655]/10 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-sky-500/10 blur-3xl"
        aria-hidden="true"
      />

      <header className="w-full max-w-6xl mx-auto px-4 sm:px-6 pt-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#FF4655] flex items-center justify-center shrink-0">
            <svg
              viewBox="0 0 24 24"
              className="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              aria-hidden="true"
            >
              <path d="M4 6l8 12 8-12" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M12 4v6" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <div className="font-display font-bold text-base tracking-tight text-white">
              VALORANT TRAINING HUB
            </div>
            <div className="text-[11px] text-slate-400">
              TRAIN SMART. AIM BETTER. WIN TOGETHER.
            </div>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 font-mono">
          <span className="text-emerald-400">Cloud Firestore Real-time Sync</span>
          <span>·</span>
          <span className="text-sky-400">Manager Controlled</span>
        </div>
      </header>

      <main className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 flex-1 flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#121621] border border-white/10 text-xs text-sky-400 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-[#FF4655]" />
              <span>Hệ thống Quản lý Đội tuyển, Lịch Scrim &amp; AI Đánh Giá Hiệu Quả Tập Aim</span>
            </div>

            <div className="space-y-3">
              <h1 className="font-display font-bold text-2xl sm:text-4xl text-white tracking-tight leading-tight">
                Trung tâm huấn luyện Esports với{' '}
                <span className="text-[#FF4655]">Database Đồng Nhất</span> &amp; Phân Quyền Manager.
              </h1>
              <p className="text-sm text-slate-300 leading-relaxed max-w-xl">
                Toàn bộ dữ liệu đội hình, bài tập hằng ngày, điểm số Aim, ảnh chụp màn hình bằng chứng, đánh giá hiệu quả bằng AI và lịch Scrim được đồng bộ thời gian thực trên mọi máy tính và trình duyệt giữa{' '}
                <strong className="text-white">Manager</strong> và các{' '}
                <strong className="text-white">Tuyển thủ (Player)</strong>.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-[#121621] border border-white/[0.07] space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                  <Shield className="w-3.5 h-3.5 text-[#FF4655]" />
                  <span>Quyền Manager kiểm soát</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Chỉ Manager mới được thêm tuyển thủ, cấp tài khoản, giao nhiệm vụ và chốt lịch Scrim.
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-[#121621] border border-white/[0.07] space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                  <Crosshair className="w-3.5 h-3.5 text-violet-400" />
                  <span>Đồng bộ Mọi Thiết Bị</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Mọi máy tính và trình duyệt đều kết nối trực tiếp vào cùng một Cloud Firestore thời gian thực.
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-[#121621] border border-white/[0.07] space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>AI Nhận xét &amp; Đề xuất</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Tuyển thủ tự khai báo bài tập Aim trong ngày, AI chấm điểm hiệu quả và gợi ý cần tập thêm gì.
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 flex justify-center lg:justify-end">
            {formCard}
          </div>
        </div>
      </main>

      <footer className="w-full max-w-6xl mx-auto px-4 sm:px-6 pb-5 text-xs text-slate-500 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <span>VALORANT TRAINING HUB · Cloud Real-time Unified Database</span>
        <span>Đăng nhập nhanh: noti (12345678) · binh (123456789)</span>
      </footer>
    </div>
  );
}
