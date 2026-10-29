import React, { useState, useEffect } from 'react';
import { Milk, Lock, User, AlertCircle, Key, ArrowRight, X } from 'lucide-react';
import { authService, AuthStaff, DemoAccount } from '../../services/auth';

interface LoginModalProps {
  isOpen: boolean;
  isDismissible?: boolean;
  onClose: () => void;
  onLoginSuccess: (staff: AuthStaff, permissions: string[]) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  isDismissible = true,
  onClose,
  onLoginSuccess,
}) => {
  const [username, setUsername] = useState('manager');
  const [password, setPassword] = useState('TH@12345');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoAccounts, setDemoAccounts] = useState<DemoAccount[]>([]);

  useEffect(() => {
    if (isOpen) {
      authService.getDemoAccounts().then(setDemoAccounts).catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await authService.login(username, password);
      onLoginSuccess(res.staff, res.permissions);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Đăng nhập thất bại, vui lòng kiểm tra lại');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDemo = (account: DemoAccount) => {
    setUsername(account.username);
    setPassword(account.defaultPassword);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150 relative">
        {/* Header */}
        <div className="bg-[#004885] px-6 py-6 text-white text-center relative">
          {isDismissible && (
            <button
              type="button"
              onClick={onClose}
              title="Đóng"
              className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <div className="w-14 h-14 bg-white rounded-xl mx-auto flex items-center justify-center text-[#004885] shadow-lg mb-3">
            <Milk className="w-8 h-8 text-[#004885]" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">TH true mart</h2>
          <p className="text-xs text-sky-200 mt-1">Hệ thống quản lý bán hàng & kho cửa hàng</p>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tên đăng nhập
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Nhập tên đăng nhập..."
                  required
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004885]/30 focus:border-[#004885]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mật khẩu
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu..."
                  required
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004885]/30 focus:border-[#004885]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#004885] hover:bg-[#00386b] text-white text-sm font-semibold rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <span>Đang xác thực...</span>
              ) : (
                <>
                  <span>Đăng nhập hệ thống</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Accounts Selection */}
          <div className="mt-6 pt-5 border-t border-slate-200">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-2.5">
              <Key className="w-3.5 h-3.5 text-amber-500" />
              <span>Tài khoản mẫu để chấm vấn đáp (Click để điền nhanh):</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setUsername('manager');
                  setPassword('TH@12345');
                  setError(null);
                }}
                className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                  username === 'manager'
                    ? 'border-[#004885] bg-sky-50/70 text-[#004885]'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50 text-slate-700'
                }`}
              >
                <div className="text-[11px] font-bold">👑 Quản lý</div>
                <div className="text-[10px] text-slate-500">manager</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setUsername('cashier');
                  setPassword('TH@12345');
                  setError(null);
                }}
                className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                  username === 'cashier'
                    ? 'border-[#004885] bg-sky-50/70 text-[#004885]'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50 text-slate-700'
                }`}
              >
                <div className="text-[11px] font-bold">🛒 Thu ngân</div>
                <div className="text-[10px] text-slate-500">cashier</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setUsername('warehouse');
                  setPassword('TH@12345');
                  setError(null);
                }}
                className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                  username === 'warehouse'
                    ? 'border-[#004885] bg-sky-50/70 text-[#004885]'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50 text-slate-700'
                }`}
              >
                <div className="text-[11px] font-bold">📦 Thủ kho</div>
                <div className="text-[10px] text-slate-500">warehouse</div>
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 text-center">
              Mật khẩu mặc định: <span className="font-mono text-slate-600 font-medium">TH@12345</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
