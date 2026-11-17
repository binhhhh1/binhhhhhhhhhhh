import React from 'react';
import { Bell, CheckCheck, X } from 'lucide-react';
import type { TeamNotification } from '../../types/training';

interface NotificationDrawerProps {
  open: boolean;
  onClose: () => void;
  notifications: TeamNotification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}

const TYPE_LABELS: Record<TeamNotification['type'], string> = {
  drill_due: 'Bài tập đến hạn',
  scrim_upcoming: 'Sắp đến giờ Scrim',
  scrim_created: 'Lịch Scrim mới',
  scrim_updated: 'Scrim thay đổi',
  availability_updated: 'Cập nhật lịch trống',
  drill_assigned: 'Giao bài tập mới',
};

export function NotificationDrawer({
  open,
  onClose,
  notifications,
  onMarkRead,
  onMarkAllRead,
}: NotificationDrawerProps) {
  if (!open) return null;

  const sorted = [...notifications].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const unreadCount = sorted.filter((n) => !n.read).length;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="fixed inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        aria-label="Trung tâm thông báo"
        className="relative z-10 w-full max-w-md bg-[#0D1017] border-l border-white/10 h-full flex flex-col"
      >
        <div className="h-16 px-5 border-b border-white/[0.07] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Bell className="w-4 h-4 text-[#FF4655]" />
            <h2 className="font-display font-semibold text-base text-white">
              Notification Center
            </h2>
            <span className="text-xs font-mono tabular-nums text-slate-400">
              {unreadCount} chưa đọc
            </span>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="px-2.5 py-1.5 rounded-md text-xs text-sky-400 hover:bg-white/5 flex items-center gap-1 whitespace-nowrap"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Đọc tất cả</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng trung tâm thông báo"
              className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-white/[0.06]">
          {sorted.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">
              Chưa có thông báo nào trong hệ thống.
            </div>
          ) : (
            sorted.map((item) => (
              <div
                key={item.id}
                className={`p-4 transition-colors ${
                  item.read ? 'opacity-70' : 'bg-[#121621]'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-xs text-slate-400 mb-1">
                  <span className={item.read ? 'text-slate-400' : 'text-[#FF4655] font-medium'}>
                    {TYPE_LABELS[item.type]}
                  </span>
                  <span className="font-mono tabular-nums">
                    {item.createdAt.slice(0, 16).replace('T', ' ')}
                  </span>
                </div>
                <div className="text-sm font-medium text-white">{item.title}</div>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  {item.message}
                </p>
                {!item.read && (
                  <button
                    type="button"
                    onClick={() => onMarkRead(item.id)}
                    className="mt-2.5 text-xs font-medium text-sky-400 hover:text-sky-300"
                  >
                    Đánh dấu đã đọc
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}
