# 02 — Docker & CI với GitHub Actions (Ngày 1, chiều)

## Phần A — Docker

### Lab A1: Chạy cả hệ thống
```powershell
docker compose up --build
```
Mở http://localhost:3000, thêm vài todo. Mở http://localhost:8080/health.

Trình tự khởi động (đọc `docker-compose.yml`):
`db` healthy → `migrate` chạy xong (exit 0) → `backend` → `frontend`.
Đây chính là mô hình thu nhỏ của Cloud: `migrate` ≈ Cloud Run Job, `backend`/`frontend` ≈ Cloud Run Service.

### Lab A2: Đọc hiểu multi-stage Dockerfile (`backend/Dockerfile`)
| Stage | Làm gì | Vì sao tách |
|---|---|---|
| `base` | node:24-slim + openssl | Prisma engine cần openssl |
| `deps` | `COPY package*.json` → `npm ci` | Code đổi nhưng deps không đổi → **cache layer**, build nhanh |
| `build` | `prisma generate`, `nest build`, `npm prune --omit=dev` | Bỏ devDependencies |
| `runner` | chỉ copy `dist`, `node_modules`, `prisma` | Image nhỏ, ít lỗ hổng, `USER node` không chạy root |

Thử:
```powershell
docker images | Select-String cicd     # so kích thước image
docker compose build backend          # chạy lần 2: thấy CACHED ở bước npm ci
# Sửa 1 dòng trong backend/src/health.controller.ts rồi build lại: npm ci vẫn CACHED
```

### Lab A3: Biến môi trường build-time vs run-time — điểm hay bị hỏi nhất
- **BE**: đọc `process.env` lúc *chạy* → 1 image dùng cho mọi env, chỉ đổi env var.
- **FE NextJS**: biến `NEXT_PUBLIC_*` bị *thay thẳng vào JS lúc build* → muốn đổi API URL phải **build lại**.

Thử: đổi `NEXT_PUBLIC_API_URL` trong `docker-compose.yml` thành `http://localhost:9999`, chạy `docker compose up -d` (không `--build`) → FE vẫn gọi 8080. Thêm `--build` → mới đổi. Đổi lại như cũ sau khi thử.

### Lab A4: Chạy không cần Docker (dev hằng ngày)
```powershell
docker compose up -d db                       # chỉ DB
cd backend;  copy .env.example .env;  npx prisma migrate deploy;  npm run start:dev
cd frontend; copy .env.example .env.local;  npm run dev
```

### Lab A5: Thêm 1 migration (cách dev thật làm)
1. Thêm field vào `backend/prisma/schema.prisma`, vd `priority Int @default(0)` trong model `Todo`
2. `cd backend; npx prisma migrate dev --name add_priority` → sinh thư mục mới trong `prisma/migrations/`
3. Commit thư mục migration đó. **Trên cloud không bao giờ chạy `migrate dev`**, chỉ chạy `migrate deploy` (áp các file đã commit).

---

## Phần B — GitHub Actions CI

### Từ vựng tối thiểu
| Khái niệm | Ý nghĩa | Ví dụ trong repo |
|---|---|---|
| workflow | 1 file YAML trong `.github/workflows` | `ci.yml` |
| trigger (`on`) | sự kiện kích hoạt | `pull_request`, `push`, `workflow_call`, `workflow_dispatch` |
| job | nhóm step chạy trên 1 máy (runner) — các job mặc định chạy **song song** | `backend`, `frontend`, `docker` |
| `needs` | job chờ job khác | `docker` needs `backend`, `frontend` |
| step | 1 lệnh hoặc 1 action | `run: npm ci`, `uses: actions/checkout@v4` |
| `services` | container phụ chạy cạnh job | Postgres trong job `backend` |
| `matrix` | nhân bản job theo tham số | build docker cho `[backend, frontend]` |
| reusable workflow | workflow gọi workflow khác | `deploy-dev.yml` → `_deploy.yml` |
| environment | nhóm biến + luật bảo vệ theo môi trường | `dev`, `test`, `prod` |
| `vars` vs `secrets` | biến thường vs biến bí mật (bị che trong log) | `vars.GCP_REGION` |
| `concurrency` | chống chạy chồng | `deploy-prod` không chạy 2 lần cùng lúc |

### Lab B1: Đưa lên GitHub
```powershell
git init -b main
git add .
git commit -m "chore: initial CICD project"
git checkout -b develop
# Tạo repo trống trên GitHub (vd cicd-lab), rồi:
git remote add origin https://github.com/<you>/cicd-lab.git
git push -u origin main develop
```
Lúc này `deploy-dev`/`deploy-test` sẽ chạy và **job deploy fail** (chưa có GCP) — bình thường, job `ci` vẫn phải xanh. Ngày 2 sẽ sửa.

> Muốn tạm tắt deploy: tab **Actions** → chọn workflow → `...` → **Disable workflow**.

### Lab B2: Thấy CI chặn code lỗi
```powershell
git checkout -b feature/break-test develop
# Sửa backend/src/todos/todos.service.ts: đổi `done: !todo.done` thành `done: true`
git commit -am "feat: buggy toggle"; git push -u origin feature/break-test
```
Mở PR vào `develop` → job **Backend** đỏ ở bước *Unit test*. Đọc log, sửa lại, push → xanh.

### Lab B3: Bật branch protection (bắt buộc CI xanh mới được merge)
Settings → Branches (hoặc Rules → Rulesets) → `develop` và `main`:
- ✅ Require a pull request before merging
- ✅ Require status checks to pass → chọn `Backend (NestJS)`, `Frontend (Next.js)`, `Docker build (backend)`, `Docker build (frontend)`

### Lab B4: Đọc hiểu cache
`actions/setup-node` với `cache: npm` → lần 2 `npm ci` nhanh hơn rõ. Job docker dùng `cache-from/to: type=gha`. So thời gian lần chạy 1 và 2 trong tab Actions.

## Bài học thật lúc dựng project này 🔥
1. **`npm ci` fail trong Docker dù máy chạy ngon**: lockfile do npm 11.6 (máy) tạo, image dùng npm khác → "lock file not in sync". Cách sửa: thống nhất Node version qua `.nvmrc` (CI đọc `node-version-file`), Dockerfile cùng major, và tạo lockfile bằng đúng phiên bản npm đó.
2. **Port 5432 đã bị chiếm** bởi Postgres cài sẵn → map ra 5433. Đọc kỹ lỗi `port is already allocated`.
3. **`AUTH_DISABLED` chỉ dành cho local** → `main.ts` chủ động crash nếu bật ở prod. Luôn có "chốt an toàn" cho cờ nguy hiểm.

## Tự kiểm tra
- [ ] Vì sao `COPY package*.json` + `npm ci` đặt *trước* `COPY . .`?
- [ ] `npm ci` khác `npm install` thế nào, vì sao CI dùng `npm ci`?
- [ ] Đổi API URL cho FE thì phải làm gì? Còn BE?
- [ ] Job `docker` có chạy nếu `backend` fail không? Vì sao?
- [ ] `prisma migrate dev` và `prisma migrate deploy` khác nhau thế nào?
