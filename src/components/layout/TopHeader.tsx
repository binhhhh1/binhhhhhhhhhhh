import React, { useEffect, useState } from 'react';
import { Bell, Cloud, LogOut, Menu, RefreshCw } from 'lucide-react';
import type { CloudHubSyncStatus } from '../../services/localAuth';
import type { DataSourceMode, NavSection, TeamRole, UserProfile } from '../../types/training';
import { getVNClockDisplay } from '../../utils/timezone';

const SECTION_TITLES: Record<NavSection, string> = {
  dashboard: 'Tổng quan luyện tập',
  'daily-training': 'Daily Training',
  'scrim-schedule': 'Scrim Schedule',
  availability: 'Quản lý lịch trống',
  'team-management': 'Quản lý đội tuyển',
};

interface TopHeaderProps {
  activeSection: NavSection;
  unreadNotifications: number;
  onOpenNotifications: () => void;
  onOpenMobileMenu: () => void;
  dataMode: DataSourceMode;
  userProfile: UserProfile | null;
  activeRole: TeamRole;
  isAdminAccount?: boolean;
  cloudSyncStatus?: CloudHubSyncStatus;
  onForceCloudSync?: () => Promise<void>;
  onSignOut: () => void;
}

export function TopHeader({
  activeSection,
  unreadNotifications,
  onOpenNotifications,
  onOpenMobileMenu,
  userProfile,
  activeRole,
  isAdminAccount,
  cloudSyncStatus,
  onForceCloudSync,
  onSignOut,
}: TopHeaderProps) {
  const [clock, setClock] = useState(() => getVNClockDisplay());
  const [imgError, setImgError] = useState(false);
  const [syncingNow, setSyncingNow] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      setClock(getVNClockDisplay());
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const handleManualSync = async () => {
    if (!onForceCloudSync || syncingNow) return;
    setSyncingNow(true);
    try {
      await onForceCloudSync();
    } finally {
      setSyncingNow(false);
    }
  };

  return (
    <header className="h-16 bg-[#0D1017] border-b border-white/[0.07] px-4 lg:px-6 flex items-center justify-between gap-4 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Mở menu điều hướng"
          className="lg:hidden p-2 rounded-lg text-slate-300 hover:bg-white/5 hover:text-white shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h1 className="font-display font-semibold text-sm sm:text-lg text-white truncate">
            {SECTION_TITLES[activeSection]}
          </h1>
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
            <span className="capitalize">{clock.weekday}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{clock.dateLabel}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-sky-400">{clock.time} (ICT)</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Live Cross-Device Cloud Sync Badge */}
        <button
          type="button"
          onClick={() => void handleManualSync()}
          title="Nhấn để làm mới dữ liệu trực tiếp từ Cloud Firestore"
          className="px-2.5 py-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-emerald-300 flex items-center gap-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
        >
          <Cloud className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="hidden xl:inline">Cloud Sync</span>
          <span className="font-mono text-[11px] text-emerald-200">
            v{cloudSyncStatus?.revision || 1}
          </span>
          <RefreshCw
            className={`w-3 h-3 text-emerald-400 ${syncingNow ? 'animate-spin' : ''}`}
          />
        </button>

        <button
          type="button"
          onClick={onOpenNotifications}
          aria-label={`Mở trung tâm thông báo (${unreadNotifications} chưa đọc)`}
          className="relative px-2.5 sm:px-3 py-2 rounded-lg bg-[#121621] border border-white/[0.08] hover:border-white/20 text-slate-200 flex items-center gap-1.5 sm:gap-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
        >
          <Bell className="w-4 h-4 text-slate-300" />
          <span className="hidden sm:inline">Thông báo</span>
          {unreadNotifications > 0 && (
            <span className="font-mono tabular-nums text-[#FF4655] font-semibold">
              {unreadNotifications}
            </span>
          )}
        </button>

        {userProfile && (
          <div className="flex items-center gap-2.5 pl-2 border-l border-white/10">
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-[#121621] border border-white/10 shrink-0 flex items-center justify-center">
              {!imgError ? (
                <img
                  src="/src/assets/images/avatar_pro_player_1794933549478.jpg"
                  alt={userProfile.displayName}
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xs font-semibold text-slate-200">
                  {userProfile.displayName.slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <div className="hidden md:block text-left min-w-0">
              <div className="text-xs font-medium text-white truncate max-w-[140px]">
                {userProfile.riotId || userProfile.displayName}
              </div>
              <div className="text-[11px] text-slate-400">
                {isAdminAccount
                  ? 'Admin · Manager'
                  : activeRole === 'coach'
                  ? 'Manager / Coach'
                  : 'Tuyển thủ (Player)'}{' '}
                · Cloud DB
              </div>
            </div>
            <button
              type="button"
              onClick={onSignOut}
              aria-label="Đăng xuất tài khoản"
              className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-[#FF4655]/20 text-slate-300 hover:text-white flex items-center gap-1.5 text-xs font-medium transition-colors"
              title="Đăng xuất"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Đăng xuất</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
