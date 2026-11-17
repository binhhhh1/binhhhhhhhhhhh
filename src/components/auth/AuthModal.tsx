import React, { useState } from 'react';
import {
  CheckCircle2,
  Crosshair,
  Lock,
  Shield,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  GAME_ROLES,
  type GameRole,
  type TeamRole,
} from '../../types/training';

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
  savedAccounts,
  onClose,
  onClearError,
  onSubmit,
}: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [riotId, setRiotId] = useState('');
  const [gameRole, setGameRole] = useState<GameRole>('Duelist');
  const [mainAgent, setMainAgent] = useState('Jett');
  const [managerIdentifier, setManagerIdentifier] = useState('binh');
  const [managerPassword, setManagerPassword] = useState('');
  const [useCloudSync, setUseCloudSync] = useState(false);

  if (!open) return null;

  const managerAccounts = savedAccounts.filter(
    (a) => a.teamRole === 'coach' || a.isAdmin,
  );
  const playerAccounts = savedAccounts.filter(
    (a) => a.teamRole !== 'coach' && !a.isAdmin,
  );

  const handleTabSwitch = (nextMode: 'login' | 'register') => {
    setMode(nextMode);
    onClearError();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      mode,
      identifier,
      password,
      displayName,
      riotId,
      teamRole: 'player',
      gameRole,
      mainAgent,
      managerIdentifier,
      managerPassword,
      useCloudSync,
    });
  };

  const formCard = (
    <div
      role={fullPage ? undefined : 'dialog'}
      aria-modal={fullPage ? undefined : 'true'}
      aria-labelledby="auth-modal-title"
      className="w-full max-w-md bg-[#121621] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
    >
      <div className="px-5 py-4 border-b border-white/[0.07] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#FF4655]/15 border border-[#FF4655]/40 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-[#FF4655]" />
          </div>
          <div>
            <h2
              id="auth-modal-title"
              className="font-display font-semibold text-base text-white"
            >
              {mode === 'login'
                ? 'Đăng nhập hệ thống'
                : 'Cấp tài khoản Tuyển thủ (Manager)'}
            </h2>
            <p className="text-[11px] text-slate-400">
              {mode === 'login'
                ? 'Cơ sở dữ liệu đồng nhất giữa Ban Huấn Luyện & Tuyển thủ'
                : 'Chỉ quyền Manager mới được phép thêm tuyển thủ vào đội'}
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

      {/* Mode Tabs */}
      <div className="grid grid-cols-2 border-b border-white/[0.07] bg-[#0D1017]">
        <button
          type="button"
          onClick={() => handleTabSwitch('login')}
          className={`py-3 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 border-b-2 ${
            mode === 'login'
              ? 'border-[#FF4655] text-white bg-white/[0.03]'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Đăng nhập</span>
        </button>
        <button
          type="button"
          onClick={() => handleTabSwitch('register')}
          className={`py-3 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 border-b-2 ${
            mode === 'register'
              ? 'border-[#FF4655] text-white bg-white/[0.03]'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Thêm Tuyển Thủ (Manager)</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
        {error && (
          <div className="p-3 rounded-lg bg-[#FF4655]/15 border border-[#FF4655]/40 text-xs text-red-200 leading-relaxed">
            {error}
          </div>
        )}

        {mode === 'login' && (
          <div className="space-y-2.5">
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
                  <span>Tuyển thủ trực thuộc Manager (Mật khẩu mặc định: 123456):</span>
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
        )}

        {mode === 'register' && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-400/30 space-y-3">
            <div className="text-xs font-semibold text-amber-200 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Xác thực quyền Manager để thêm tuyển thủ</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Chỉ tài khoản có quyền <strong>Manager</strong> (VD: <code className="text-amber-300">noti</code> hoặc{' '}
              <code className="text-amber-300">binh</code>) mới được phép thêm tuyển thủ mới. Tuyển thủ tạo ra sẽ thuộc quyền kiểm soát của Manager trên cùng database.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label
                  htmlFor="auth-manager-id"
                  className="block text-[11px] font-medium text-slate-300 mb-1"
                >
                  Tài khoản Manager *
                </label>
                <input
                  id="auth-manager-id"
                  type="text"
                  required
                  value={managerIdentifier}
                  onChange={(e) => setManagerIdentifier(e.target.value)}
                  placeholder="noti hoặc binh"
                  className="w-full bg-[#090B10] border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                />
              </div>
              <div>
                <label
                  htmlFor="auth-manager-pw"
                  className="block text-[11px] font-medium text-slate-300 mb-1"
                >
                  Mật khẩu Manager *
                </label>
                <input
                  id="auth-manager-pw"
                  type="password"
                  required
                  value={managerPassword}
                  onChange={(e) => setManagerPassword(e.target.value)}
                  placeholder="Mật khẩu của Manager"
                  className="w-full bg-[#090B10] border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white"
                />
              </div>
            </div>
          </div>
        )}

        <div>
          <label
            htmlFor="auth-identifier"
            className="block text-xs font-medium text-slate-300 mb-1.5"
          >
            {mode === 'login'
              ? 'Tên đăng nhập hoặc Email *'
              : 'Tên đăng nhập cấp cho Tuyển thủ *'}
          </label>
          <input
            id="auth-identifier"
            type="text"
            required
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder={
              useCloudSync
                ? 'email@example.com'
                : mode === 'login'
                ? 'VD: noti, binh, kyro...'
                : 'VD: tenz_vn'
            }
            className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400"
          />
        </div>

        <div>
          <label
            htmlFor="auth-password"
            className="block text-xs font-medium text-slate-300 mb-1.5"
          >
            {mode === 'login'
              ? 'Mật khẩu *'
              : 'Mật khẩu cấp cho Tuyển thủ * (tối thiểu 6 ký tự)'}
          </label>
          <input
            id="auth-password"
            type="password"
            required
            minLength={6}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••"
            className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400"
          />
        </div>

        {mode === 'register' && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="auth-display-name"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Họ tên / Nickname Tuyển thủ *
                </label>
                <input
                  id="auth-display-name"
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="VD: Minh Tuấn"
                  className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500"
                />
              </div>
              <div>
                <label
                  htmlFor="auth-riot-id"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Riot ID *
                </label>
                <input
                  id="auth-riot-id"
                  type="text"
                  required
                  value={riotId}
                  onChange={(e) => setRiotId(e.target.value)}
                  placeholder="VD: Tuấn#VN1"
                  className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label
                  htmlFor="auth-team-role"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Phân quyền
                </label>
                <input
                  id="auth-team-role"
                  type="text"
                  disabled
                  value="Player (Trực thuộc Manager)"
                  className="w-full bg-[#090B10]/60 border border-white/10 rounded-lg px-2.5 py-2 text-xs text-sky-400 font-medium cursor-not-allowed"
                />
              </div>

              <div>
                <label
                  htmlFor="auth-game-role"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Role In-game
                </label>
                <select
                  id="auth-game-role"
                  value={gameRole}
                  onChange={(e) => setGameRole(e.target.value as GameRole)}
                  className="w-full bg-[#090B10] border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white"
                >
                  {GAME_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="auth-main-agent"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Main Agent
                </label>
                <input
                  id="auth-main-agent"
                  type="text"
                  value={mainAgent}
                  onChange={(e) => setMainAgent(e.target.value)}
                  placeholder="Jett"
                  className="w-full bg-[#090B10] border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white"
                />
              </div>
            </div>
          </>
        )}

        {mode === 'login' && (
          <label className="flex items-start gap-2.5 p-3 rounded-lg bg-[#090B10] border border-white/[0.07] cursor-pointer">
            <input
              type="checkbox"
              checked={useCloudSync}
              onChange={(e) => setUseCloudSync(e.target.checked)}
              className="mt-0.5 accent-sky-400"
            />
            <span className="text-[11px] text-slate-300 leading-relaxed">
              Đồng bộ qua tài khoản Email/Mật khẩu Firebase Auth (tùy chọn). Bỏ chọn để đăng nhập hệ thống Database hợp nhất của đội.
            </span>
          </label>
        )}

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
            className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-[#FF4655] hover:bg-[#e53c4a] disabled:opacity-60 text-xs font-semibold text-white transition-colors"
          >
            {busy
              ? 'Đang xử lý...'
              : mode === 'login'
              ? 'Đăng nhập vào Hub'
              : 'Xác nhận thêm Tuyển thủ'}
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
          <span>Database hợp nhất toàn đội</span>
          <span>·</span>
          <span className="text-sky-400">Manager Controlled</span>
        </div>
      </header>

      <main className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 flex-1 flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#121621] border border-white/10 text-xs text-sky-400 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-[#FF4655]" />
              <span>Hệ thống Quản lý Đội tuyển, Lịch Scrim &amp; Giáo án Aim Valorant</span>
            </div>

            <div className="space-y-3">
              <h1 className="font-display font-bold text-2xl sm:text-4xl text-white tracking-tight leading-tight">
                Trung tâm huấn luyện Esports với{' '}
                <span className="text-[#FF4655]">Database Đồng Nhất</span> &amp; Phân Quyền Manager.
              </h1>
              <p className="text-sm text-slate-300 leading-relaxed max-w-xl">
                Toàn bộ dữ liệu đội hình, bài tập hằng ngày, điểm số Aim, ảnh chụp màn hình bằng chứng và lịch Scrim được đồng bộ xuyên suốt giữa{' '}
                <strong className="text-white">Manager</strong> và các{' '}
                <strong className="text-white">Tuyển thủ (Player)</strong>. Chỉ Manager mới có quyền thêm, xóa và kiểm soát tuyển thủ trong đội.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-[#121621] border border-white/[0.07] space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                  <Shield className="w-3.5 h-3.5 text-[#FF4655]" />
                  <span>Quyền Manager kiểm soát</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Chỉ Manager mới được thêm tuyển thủ, cấp tài khoản, giao bài tập bắt buộc và duyệt bằng chứng.
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-[#121621] border border-white/[0.07] space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                  <Crosshair className="w-3.5 h-3.5 text-violet-400" />
                  <span>Database đồng nhất</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Mọi cập nhật từ Manager và Tuyển thủ đều lưu chung trên một cơ sở dữ liệu đội tuyển duy nhất.
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-[#121621] border border-white/[0.07] space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>AI Drills &amp; Bằng chứng</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Tự động tạo bài tập Tracking, Flick mỗi ngày và chụp màn hình chứng minh kết quả.
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
        <span>VALORANT TRAINING HUB · Unified Esports Database</span>
        <span>Hỗ trợ đăng nhập nhanh: noti (12345678) · binh (123456789) · kyro (123456)</span>
      </footer>
    </div>
  );
}
