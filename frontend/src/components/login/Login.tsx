import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchApi } from "../../lib/api"; // Đường dẫn tuỳ vào vị trí file

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Gọi API Login (không cần gắn Bearer token vì file api.ts tự lo, hoặc API này chưa cần token)
      const res: any = await fetchApi("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });

      if (res.access_token) {
        // 1. Lưu token và thông tin user (cashier) xuống LocalStorage
        localStorage.setItem("access_token", res.access_token);
        localStorage.setItem("user_info", JSON.stringify(res.user));

        // 2. Chuyển hướng về trang chủ / màn hình POS
        navigate("/");
      }
    } catch (err: any) {
      setError(err.message || "Sai tài khoản hoặc mật khẩu");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="p-8 bg-white rounded shadow-md w-96">
        <h2 className="mb-6 text-2xl font-bold text-center text-blue-600">
          Đăng nhập TH True Mart
        </h2>

        {error && (
          <div className="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label className="block mb-1 text-sm font-medium">
              Tên đăng nhập
            </label>
            <input
              type="text"
              required
              className="w-full p-2 border rounded focus:outline-blue-500"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="mb-6">
            <label className="block mb-1 text-sm font-medium">Mật khẩu</label>
            <input
              type="password"
              required
              className="w-full p-2 border rounded focus:outline-blue-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full p-2 text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Đang xử lý..." : "Đăng nhập"}
          </button>
        </form>
      </div>
    </div>
  );
}
