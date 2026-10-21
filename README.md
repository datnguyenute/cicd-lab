# CI/CD thực chiến trong 2 ngày — NestJS + NextJS + Cloud Run + Cloud SQL + Firebase

Project mô phỏng đúng stack của công ty:

| # | Thành phần | Trong project này |
|---|---|---|
| 1 | GitHub Actions chạy CI | `.github/workflows/ci.yml` |
| 2 | FE NextJS | `frontend/` (Next 15, App Router, `output: standalone`) |
| 3 | BE NestJS | `backend/` (Nest 11 + Prisma) |
| 4 | Cloud Run deploy FE + BE | `.github/workflows/_deploy.yml` |
| 5 | Cloud SQL Postgres | `backend/prisma/` + `infra/gcp-bootstrap.sh` |
| 6 | 3 môi trường Dev / Test / Prod | `deploy-dev.yml`, `deploy-test.yml`, `deploy-prod.yml` |
| 7 | Đăng nhập Firebase | `frontend/lib/firebase.ts` → `backend/src/auth/firebase-auth.guard.ts` |
| 8 | Docker | `backend/Dockerfile`, `frontend/Dockerfile`, `docker-compose.yml` |

## Chạy ngay (5 phút)

```powershell
docker compose up --build
# FE:  http://localhost:3000
# BE:  http://localhost:8080/health
# DB:  localhost:5433  (user/pass/db = app/app/app)
```

Local chạy với `AUTH_DISABLED=true` (bỏ qua Firebase) để học Docker/CI trước, Firebase học sau.

## Lộ trình 2 ngày

Đọc theo thứ tự. Mỗi file có **Lab** (làm tay) và **Tự kiểm tra** (câu hỏi phải trả lời được).

| Buổi | Tài liệu | Kết quả cuối buổi |
|---|---|---|
| Ngày 1 sáng | [docs/01-kien-truc.md](docs/01-kien-truc.md) | Vẽ lại được sơ đồ hệ thống + luồng 3 môi trường bằng tay |
| Ngày 1 chiều | [docs/02-ngay-1-docker-va-ci.md](docs/02-ngay-1-docker-va-ci.md) | Chạy được bằng Docker, đẩy lên GitHub, PR có CI xanh |
| Ngày 2 sáng | [docs/03-ngay-2-gcp-firebase-deploy.md](docs/03-ngay-2-gcp-firebase-deploy.md) | Dev/Test/Prod chạy thật trên Cloud Run, đăng nhập Google được |
| Ngày 2 chiều | [docs/04-goc-nhin-TA.md](docs/04-goc-nhin-TA.md) | Trả lời được "tại sao" cho từng quyết định, biết soi project công ty |

## Cấu trúc

```
.
├── .github/workflows/
│   ├── ci.yml            # PR → typecheck, test, migrate thử, build, docker build
│   ├── _deploy.yml       # workflow tái sử dụng: build → push → migrate → deploy → smoke test
│   ├── deploy-dev.yml    # push develop      → DEV
│   ├── deploy-test.yml   # push main         → TEST
│   └── deploy-prod.yml   # tag v*.*.* + duyệt → PROD
├── backend/              # NestJS + Prisma + firebase-admin
├── frontend/             # NextJS + firebase (web SDK)
├── infra/
│   ├── gcp-bootstrap.sh  # tạo Artifact Registry, Cloud SQL, Secret, Service Account, WIF
│   └── gcp-cleanup.sh    # xoá tài nguyên tốn tiền khi học xong
├── docker-compose.yml    # cả hệ thống ở local
└── .nvmrc                # Node 24 — dùng chung cho máy dev, CI, Dockerfile
```

> ⚠️ Cloud SQL tính tiền theo giờ kể cả khi không dùng. Học xong chạy `infra/gcp-cleanup.sh`.
