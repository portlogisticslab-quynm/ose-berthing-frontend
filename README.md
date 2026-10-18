# ose-berthing-frontend

Giao diện tĩnh (HTML/JS, không build) cho `berthing.ose.vn`. Backend: `api-berthing.ose.vn` qua Worker `ose-failover`, Render dự phòng.
Mọi lệnh gọi API đi qua `window.oseFetch` (`js/config.js`, Phụ lục B). Chạy thử trên máy: `python -m http.server 5500` rồi mở `http://127.0.0.1:5500` (backend local `127.0.0.1:8006`).
Cloudflare Pages: Build command `exit 0`, Output `.`.
