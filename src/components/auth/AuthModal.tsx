import React, { useState } from 'react';
import { Lock, ShieldCheck, UserPlus, X } from 'lucide-react';
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
  useCloudSync: boolean;
}

interface AuthModalProps {
  open: boolean;
  busy: boolean;
  error: string;
  savedAccounts: Array<{
    uid: string;
    identifier: string;
    displayName: string;
    riotId: string;
    teamRole?: TeamRole;
    isAdmin?: boolean;
  }>;
  onClose: () => void;
  onClearError: () => void;
  onSubmit: (payload: AuthModalSubmitPayload) => Promise<void>;
}

export function AuthModal({
  open,
  busy,
  error,
  savedAccounts,
  onClose,
  onClearError,
  onSubmit,
}: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>(
    savedAccounts.length === 0 ? 'register' : 'login',
  );
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [riotId, setRiotId] = useState('');
  const [teamRole, setTeamRole] = useState<TeamRole>('player');
  const [gameRole, setGameRole] = useState<GameRole>('Duelist');
  const [mainAgent, setMainAgent] = useState('Jett');
  const [useCloudSync, setUseCloudSync] = useState(false);

  if (!open) return null;

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
      teamRole,
      gameRole,
      mainAgent,
      useCloudSync,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        className="w-full max-w-md bg-[#121621] border border-white/10 rounded-xl overflow-hidden max-h-[92vh] flex flex-col"
      >
        <div className="px-5 py-4 border-b border-white/[0.07] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#FF4655]" />
            <h2
              id="auth-modal-title"
              className="font-display font-semibold text-base text-white"
            >
              {mode === 'login' ? 'Đăng nhập tài khoản' : 'Tạo tài khoản mới'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ tài khoản"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="grid grid-cols-2 border-b border-white/[0.07] bg-[#0D1017]">
          <button
            type="button"
            onClick={() => handleTabSwitch('login')}
            className={`py-2.5 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 border-b-2 ${
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
            className={`py-2.5 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 border-b-2 ${
              mode === 'register'
                ? 'border-[#FF4655] text-white bg-white/[0.03]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Tạo tài khoản</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 rounded-lg bg-[#FF4655]/15 border border-[#FF4655]/40 text-xs text-red-200 leading-relaxed">
              {error}
            </div>
          )}

          {mode === 'login' && savedAccounts.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[11px] text-slate-400">Tài khoản sẵn có trên máy:</div>
              <div className="flex flex-wrap gap-1.5">
                {savedAccounts.map((acc) => (
                  <button
                    key={acc.uid}
                    type="button"
                    onClick={() => setIdentifier(acc.identifier)}
                    className="px-2.5 py-1 rounded-md bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs text-slate-200 transition-colors"
                  >
                    {acc.identifier} ·{' '}
                    <span className="text-sky-400">
                      {acc.isAdmin
                        ? 'Admin / Manager'
                        : acc.teamRole === 'coach'
                        ? 'Manager'
                        : 'Player'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label
              htmlFor="auth-identifier"
              className="block text-xs font-medium text-slate-300 mb-1.5"
            >
              Tên đăng nhập hoặc Email *
            </label>
            <input
              id="auth-identifier"
              type="text"
              required
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={useCloudSync ? 'email@example.com' : 'VD: kyro_sgv hoặc kyro@team.vn'}
              className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400"
            />
          </div>

          <div>
            <label
              htmlFor="auth-password"
              className="block text-xs font-medium text-slate-300 mb-1.5"
            >
              Mật khẩu * (tối thiểu 6 ký tự)
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
                    Tên tuyển thủ *
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
                    placeholder="VD: Kyro#VN1"
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
                    Vai trò đội
                  </label>
                  <select
                    id="auth-team-role"
                    value={teamRole}
                    onChange={(e) => setTeamRole(e.target.value as TeamRole)}
                    className="w-full bg-[#090B10] border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white"
                  >
                    <option value="player">Player</option>
                    <option value="coach">Coach / Manager</option>
                  </select>
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

          <label className="flex items-start gap-2.5 p-3 rounded-lg bg-[#090B10] border border-white/[0.07] cursor-pointer">
            <input
              type="checkbox"
              checked={useCloudSync}
              onChange={(e) => setUseCloudSync(e.target.checked)}
              className="mt-0.5 accent-sky-400"
            />
            <span className="text-[11px] text-slate-300 leading-relaxed">
              Đồng bộ Cloud Firestore bằng Email/Mật khẩu Firebase (tùy chọn). Bỏ chọn để tạo và dùng ngay tài khoản riêng lưu trên thiết bị này.
            </span>
          </label>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/[0.07]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium text-slate-300"
            >
              Đóng
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-5 py-2 rounded-lg bg-[#FF4655] hover:bg-[#e53c4a] disabled:opacity-60 text-xs font-semibold text-white"
            >
              {busy
                ? 'Đang xử lý...'
                : mode === 'login'
                ? 'Đăng nhập'
                : 'Tạo tài khoản'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
