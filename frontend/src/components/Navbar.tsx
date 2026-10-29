import React from 'react';
import { canAccessModule } from '../lib/permissions';
import { 
  ShoppingCart, 
  Package, 
  Warehouse, 
  UserCheck, 
  Truck, 
  BarChart3, 
  Clock, 
  Milk,
  ShieldCheck,
  LogOut,
  User
} from 'lucide-react';
import { AuthStaff } from '../services/auth';

interface NavbarProps {
  activeModule: number;
  setActiveModule: (mod: number) => void;
  expiringCount: number;
  permissionCodes: readonly string[] | null;
  currentStaff?: AuthStaff | null;
  onOpenLogin?: () => void;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeModule,
  setActiveModule,
  expiringCount,
  permissionCodes,
  currentStaff,
  onOpenLogin,
  onLogout,
}) => {
  const [currentTime, setCurrentTime] = React.useState<string>('');

  React.useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const bfdModules = [
    { id: 1, name: '1. Bán hàng (POS)', icon: ShoppingCart },
    { id: 2, name: '2. Hàng hóa & Khuyến mãi', icon: Package },
    { id: 3, name: '3. Quản lý kho', icon: Warehouse, badge: expiringCount > 0 ? expiringCount : null },
    { id: 4, name: '4. Quản lý nhân viên', icon: UserCheck },
    { id: 5, name: '5. Nhà cung cấp', icon: Truck },
    { id: 6, name: '6. Báo cáo thống kê', icon: BarChart3 },
  ];

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'manager':
        return <span className="bg-amber-400/25 text-amber-200 border border-amber-300/30 px-1.5 py-0.5 rounded text-[10px] font-semibold">Quản lý</span>;
      case 'cashier':
        return <span className="bg-emerald-400/25 text-emerald-200 border border-emerald-300/30 px-1.5 py-0.5 rounded text-[10px] font-semibold">Thu ngân</span>;
      case 'warehouse':
        return <span className="bg-sky-400/25 text-sky-200 border border-sky-300/30 px-1.5 py-0.5 rounded text-[10px] font-semibold">Thủ kho</span>;
      default:
        return null;
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      {/* Top Banner: Brand & System Info */}
      <div className="bg-[#004885] text-white px-4 py-2.5 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center text-[#004885] font-black tracking-wider shadow-inner">
              <Milk className="w-6 h-6 text-[#004885]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-extrabold tracking-tight">TH true mart</span>
                <span className="bg-sky-400/25 text-sky-100 text-xs px-2 py-0.5 rounded font-medium border border-sky-300/30">
                  Hệ thống quản lý bán hàng & kho
                </span>
              </div>
              <p className="text-xs text-sky-100/80">Cửa hàng số 08 - 25 Tràng Tiền, Hoàn Kiếm, Hà Nội</p>
            </div>
          </div>

          {/* Right quick stats & User Account */}
          <div className="flex items-center flex-wrap gap-2.5">
            <div className="hidden md:flex items-center gap-2 bg-[#00386b] px-3 py-1.5 rounded-lg text-xs text-sky-100">
              <Clock className="w-3.5 h-3.5 text-sky-300" />
              <span>{currentTime}</span>
              <span className="text-slate-400">|</span>
              <span className="text-emerald-300 font-medium">Hệ thống trực tuyến</span>
            </div>

            {currentStaff ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 bg-[#003360] px-3 py-1.5 rounded-lg text-xs text-sky-200 border border-sky-800/60">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div className="flex flex-col">
                    <span className="font-semibold text-white leading-tight">{currentStaff.name}</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {getRoleBadge(currentStaff.role)}
                      <span className="text-[10px] text-sky-300">({currentStaff.code})</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onLogout}
                  title="Đăng xuất / Đổi tài khoản"
                  className="flex items-center gap-1.5 bg-rose-900/40 hover:bg-rose-900/70 border border-rose-500/40 text-rose-200 px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-300" />
                  <span className="hidden sm:inline">Đăng xuất</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenLogin}
                className="flex items-center gap-1.5 bg-sky-500 hover:bg-sky-400 text-white font-semibold px-3 py-1.5 rounded-lg text-xs transition-colors shadow-sm cursor-pointer"
              >
                <User className="w-3.5 h-3.5" />
                <span>Đăng nhập</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Secondary Navigation: BFD Modules */}
      <div className="bg-slate-50 border-b border-slate-200 overflow-x-auto scrollbar-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex space-x-1 py-1.5">
          {bfdModules.filter((module) => canAccessModule(permissionCodes, module.id)).map((module) => {
            const Icon = module.icon;
            const isActive = activeModule === module.id;
            return (
              <button
                key={module.id}
                id={`nav-module-${module.id}`}
                onClick={() => setActiveModule(module.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#004885] text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-sky-200' : 'text-slate-500'}`} />
                <span>{module.name}</span>
                {module.badge && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white animate-pulse">
                    {module.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
