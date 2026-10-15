import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Store,
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
} from "lucide-react";

interface NavbarProps {
  activeModule: number;
  setActiveModule: (mod: number) => void;
  expiringCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeModule,
  setActiveModule,
  expiringCount,
}) => {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = React.useState<string>("");

  React.useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Lấy thông tin user từ localStorage để hiển thị tên động
  const userStr = localStorage.getItem("user_info");
  const currentUser = userStr ? JSON.parse(userStr) : null;

  // Thêm đoạn này để dịch chức vụ
  const roleMap: Record<string, string> = {
    manager: "Quản lý",
    cashier: "Thu ngân",
    warehouse: "Thủ kho",
  };
  const roleName = currentUser?.role ? roleMap[currentUser.role] : "Nhân viên";

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_info");
    navigate("/login");
  };

  const bfdModules = [
    { id: 1, name: "1. Bán hàng (POS)", icon: ShoppingCart },
    { id: 2, name: "2. Hàng hóa & Giá", icon: Package },
    {
      id: 3,
      name: "3. Quản lý kho",
      icon: Warehouse,
      badge: expiringCount > 0 ? expiringCount : null,
    },
    { id: 4, name: "4. Nhân viên & Ca làm", icon: UserCheck },
    { id: 5, name: "5. Nhà cung cấp", icon: Truck },
    { id: 6, name: "6. Báo cáo thống kê", icon: BarChart3 },
  ];

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
                <span className="text-lg font-extrabold tracking-tight">
                  TH true mart
                </span>
                <span className="bg-sky-400/25 text-sky-100 text-xs px-2 py-0.5 rounded font-medium border border-sky-300/30">
                  Hệ thống quản lý bán hàng & kho
                </span>
              </div>
              <p className="text-xs text-sky-100/80">
                Cửa hàng số 08 - 25 Tràng Tiền, Hoàn Kiếm, Hà Nội
              </p>
            </div>
          </div>

          {/* Right quick stats */}
          <div className="flex items-center flex-wrap gap-2.5">
            <div className="flex items-center gap-2 bg-[#00386b] px-3 py-1.5 rounded-lg text-xs text-sky-100">
              <Clock className="w-3.5 h-3.5 text-sky-300" />
              <span>{currentTime}</span>
              <span className="text-slate-400">|</span>
              <span className="text-emerald-300 font-medium">Ca làm việc</span>
            </div>

            {/* Thông tin nhân viên & Nút đăng xuất */}
            <div className="hidden sm:flex items-center gap-1.5 bg-[#003360] pl-3 pr-1 py-1 rounded-lg text-xs text-sky-200 border border-sky-800/60">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="mr-2">
                {roleName}: {currentUser?.name || "Ẩn danh"}
              </span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
                title="Đăng xuất"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Navigation: 6 Modules */}
      <div className="bg-slate-50 border-b border-slate-200 overflow-x-auto scrollbar-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex space-x-1 py-1.5">
          {bfdModules.map((module) => {
            const Icon = module.icon;
            const isActive = activeModule === module.id;
            return (
              <button
                key={module.id}
                id={`nav-module-${module.id}`}
                onClick={() => setActiveModule(module.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-[#004885] text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-200/70 hover:text-slate-900"
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${isActive ? "text-sky-200" : "text-slate-500"}`}
                />
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
