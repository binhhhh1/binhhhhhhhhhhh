import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'Đã xảy ra lỗi không mong muốn.',
    };
  }

  override render() {
    if (this.state.hasError) {
      let friendly = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message);
        if (parsed && parsed.error) {
          friendly = `Lỗi Firestore (${parsed.operationType} tại ${parsed.path || 'database'}): ${parsed.error}`;
        }
      } catch {
        // non-JSON error message
      }

      return (
        <div className="min-h-screen bg-[#090B10] text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-[#121621] border border-white/10 rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white">
              Hệ thống gặp sự cố kết nối dữ liệu
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed break-words">
              {friendly}
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-lg bg-[#FF4655] hover:bg-[#e63c4b] text-white text-sm font-medium transition-colors"
              >
                Tải lại ứng dụng
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
