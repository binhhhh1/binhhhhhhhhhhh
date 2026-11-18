import React from 'react';
import {
  CalendarDays,
  Clock,
  LayoutDashboard,
  ListChecks,
  Users,
  X,
} from 'lucide-react';
import type { DataSourceMode, NavSection, TeamRole, TeamWorkspace } from '../../types/training';

interface SidebarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  team: TeamWorkspace;
  dataMode: DataSourceMode;
  activeRole: TeamRole;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: Array<{
  id: NavSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
  { id: 'daily-training', label: 'Daily Training', icon: ListChecks },
  { id: 'scrim-schedule', label: 'Scrim Schedule', icon: CalendarDays },
  { id: 'availability', label: 'Lịch trống', icon: Clock },
  { id: 'team-management', label: 'Quản lý đội', icon: Users },
];

export function Sidebar({
  activeSection,
  onSelectSection,
  team,
  dataMode,
  activeRole,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const content = (
    <div className="flex flex-col h-full w-64 bg-[#0D1017] border-r border-white/[0.07] select-none">
      {/* Brand Mark */}
      <div className="h-16 px-5 flex items-center justify-between border-b border-white/[0.07]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#FF4655] flex items-center justify-center shrink-0">
            <svg
              viewBox="0 0 24 24"
              className="w-4 h-4 text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              aria-hidden="true"
            >
              <path d="M4 6l8 12 8-12" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M12 4v6" strokeLinecap="round" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="font-display font-bold text-sm tracking-tight text-white truncate">
              VALORANT HUB
            </div>
            <div className="text-[11px] text-slate-400 truncate">
              {team.name.startsWith(team.tag) ? team.name : `${team.tag} · ${team.name}`}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Đóng menu điều hướng"
          className="lg:hidden p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/5"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation */}
      <nav aria-label="Phân hệ chính" className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectSection(item.id);
                onCloseMobile();
              }}
              aria-current={isActive ? 'page' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                isActive
                  ? 'bg-[#FF4655]/15 text-white border border-[#FF4655]/35'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04] border border-transparent'
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 ${
                  isActive ? 'text-[#FF4655]' : 'text-slate-400'
                }`}
              />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Workspace Context Footer */}
      <div className="p-4 border-t border-white/[0.07] space-y-2 text-xs">
        <div className="text-slate-300 font-medium truncate">
          {dataMode === 'cloud'
            ? 'Cloud Firestore (Đồng bộ)'
            : 'Database Đội Tuyển Đồng Nhất'}
        </div>
        <div className="text-slate-400 flex items-center gap-1.5">
          <span>Vai trò:</span>
          <span className="text-slate-200 font-medium">
            {activeRole === 'coach' ? 'Coach / Manager' : 'Player'}
          </span>
        </div>
        <p className="text-[11px] text-slate-500 pt-1">
          Train Smart. Aim Better. Win Together.
        </p>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block shrink-0">{content}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/70"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-10 h-full">{content}</aside>
        </div>
      )}
    </>
  );
}
