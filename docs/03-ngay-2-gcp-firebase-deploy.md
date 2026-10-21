# 03 — GCP + Firebase + Deploy 3 môi trường (Ngày 2, sáng)

> Cần: tài khoản GCP có billing (free trial $300 là đủ), repo GitHub từ Lab B1.
> Chi phí chính: Cloud SQL `db-f1-micro` ~ vài chục nghìn đồng/ngày. Cloud Run min-instances=0 gần như miễn phí.

## Bước 1 — Tạo GCP project
```powershell
gcloud components update          # gcloud của bạn đang là bản 441, khá cũ
gcloud auth login
gcloud projects create cicd-lab-<tên-bạn> --name="CICD Lab"
gcloud billing projects link cicd-lab-<tên-bạn> --billing-account=<BILLING_ID>   # gcloud billing accounts list
```

## Bước 2 — Dựng hạ tầng bằng script
Chạy trong **Git Bash** (không phải PowerShell) hoặc Cloud Shell:
```bash
PROJECT_ID=cicd-lab-<tên-bạn> GITHUB_REPO=<github-user>/cicd-lab bash infra/gcp-bootstrap.sh
```
Đọc script **trước khi chạy** — mỗi khối là 1 khái niệm:
1. Bật API
2. **Artifact Registry** — "Docker Hub riêng" của bạn
3. **Cloud SQL** Postgres 16
4. 3 database + 3 user + 3 secret `database-url-{dev,test,prod}`
5. Runtime SA
6. Deployer SA
7. **Workload Identity Federation** — chỉ repo `GITHUB_REPO` được mượn quyền deployer

Cuối script in ra các giá trị cần điền vào GitHub.

Kiểm tra bằng mắt trên Console: Cloud SQL → Databases; Secret Manager; IAM → Workload Identity Federation.

## Bước 3 — Firebase Authentication
1. https://console.firebase.google.com → **Add project** → chọn *đúng GCP project vừa tạo* (Firebase dùng chung project GCP)
2. Build → **Authentication** → Get started → Sign-in method → bật **Google**
3. Project settings → General → **Your apps** → Add app (Web `</>`) → copy `apiKey`, `authDomain`, `projectId`
4. Authentication → Settings → **Authorized domains** → thêm domain FE sau khi deploy (vd `frontend-dev-123456.asia-southeast1.run.app`). Thiếu bước này: popup báo `auth/unauthorized-domain`.

> `apiKey` của Firebase Web **không phải bí mật** — nó nằm trong JS gửi xuống browser. Bảo mật nằm ở việc BE verify token + Authorized domains + Security rules. Nên để ở `vars`, không cần `secrets`.

> Công ty thật: thường **prod dùng Firebase project riêng** để user prod tách khỏi user test.

## Bước 4 — Cấu hình GitHub
**Settings → Secrets and variables → Actions → Variables → Repository variables** (dán từ output script):
`GCP_PROJECT_ID, GCP_REGION, AR_REPO, WIF_PROVIDER, DEPLOY_SA, RUNTIME_SA, CLOUDSQL_INSTANCE`

**Settings → Environments** → tạo `dev`, `test`, `prod`. Mỗi env thêm *Environment variables*:

| Variable | dev | test | prod |
|---|---|---|---|
| `FIREBASE_API_KEY` | (từ bước 3) | | |
| `FIREBASE_AUTH_DOMAIN` | `<proj>.firebaseapp.com` | | |
| `FIREBASE_PROJECT_ID` | `<proj>` | | |
| `FRONTEND_URL` | `https://frontend-dev-<PROJECT_NUMBER>.<region>.run.app` | `...-test-...` | `...-prod-...` |
| `MIN_INSTANCES` | `0` | `0` | `1` |

Riêng **prod**:
- ✅ **Required reviewers** → thêm chính bạn
- **Deployment branches and tags** → *Selected* → thêm tag pattern `v*`

> `FRONTEND_URL` dùng cho CORS của BE. URL Cloud Run có dạng cố định `https://<service>-<project-number>.<region>.run.app` nên điền trước được. Nếu sai: lần deploy đầu xong, copy URL thật từ Summary rồi sửa var và chạy lại.

## Bước 5 — Deploy DEV
```powershell
git checkout develop
git commit --allow-empty -m "chore: trigger dev deploy"
git push
```
Tab **Actions** → *Deploy DEV* → xem từng step. Cuối job có **Summary** chứa URL FE/BE.
Mở URL FE → đăng nhập Google → thêm todo. Dòng nhỏ trên cùng hiển thị `FE: dev@<sha> · BE: dev@<sha>`.

Xem trên Console: Cloud Run → `backend-dev` → tab **Revisions**, **Logs**; Cloud Run → Jobs → `backend-migrate-dev` → Executions.

## Bước 6 — Lên TEST
Mở PR `develop → main` → CI xanh → merge → *Deploy TEST* tự chạy. Để ý step build BE in ra **"đã tồn tại → tái sử dụng"** (cùng SHA nếu merge fast-forward; với merge commit SHA mới nên sẽ build lại — thử và quan sát).

## Bước 7 — Lên PROD
```powershell
git checkout main; git pull
git tag v1.0.0
git push origin v1.0.0
```
*Deploy PROD* chạy job `guard` → `ci` → dừng ở **Waiting for review**. Bấm **Review deployments → Approve** → deploy.

## Bước 8 — Rollback (phải tập trước khi cần!)
Cách 1 — chuyển traffic về revision cũ (nhanh nhất, vài giây):
```bash
gcloud run revisions list --service backend-prod --region asia-southeast1
gcloud run services update-traffic backend-prod --region asia-southeast1 --to-revisions <REVISION_CŨ>=100
```
Cách 2 — deploy lại tag cũ: tạo tag mới trỏ vào commit cũ, hoặc revert commit rồi tag `v1.0.1`.

⚠️ Rollback code **không** rollback database. Vì vậy migration phải *tương thích ngược* (xem doc 04).

## Bước 9 — Dọn dẹp
```bash
PROJECT_ID=cicd-lab-<tên-bạn> bash infra/gcp-cleanup.sh
```

## Gỡ lỗi thường gặp
| Lỗi | Nguyên nhân | Sửa |
|---|---|---|
| `Unable to acquire impersonated credentials` / `Permission iam.serviceAccounts.getAccessToken denied` | Sai `WIF_PROVIDER`, sai tên repo trong attribute-condition, hoặc thiếu `id-token: write` | Kiểm tra `GITHUB_REPO` lúc chạy bootstrap khớp đúng `owner/repo` (phân biệt hoa thường) |
| `denied: Permission "artifactregistry.repositories.uploadArtifacts"` | Deployer thiếu `artifactregistry.writer` hoặc sai region trong registry URL | Xem lại bước 6 script |
| `Permission 'iam.serviceaccounts.actAs' denied` | Deployer thiếu `serviceAccountUser` trên runtime SA | Xem lại bước 6 script |
| Job migrate fail `P1001 Can't reach database` | Thiếu `--set-cloudsql-instances` hoặc runtime SA thiếu `cloudsql.client` | |
| BE `Container failed to start and listen on PORT` | App không listen `0.0.0.0:$PORT` hoặc crash lúc start (xem Logs) | |
| FE gọi BE báo **CORS** | `FRONTEND_URL` sai | Sửa var → deploy lại |
| FE gọi `localhost:8080` trên cloud | `NEXT_PUBLIC_API_URL` không được truyền lúc **build** | |
| `auth/unauthorized-domain` | Chưa thêm domain FE vào Firebase Authorized domains | |
| BE trả 401 dù đã login | `FIREBASE_PROJECT_ID` của BE khác project FE đăng nhập | |
| `--allow-unauthenticated` lỗi policy | Org policy "Domain restricted sharing" (hay gặp ở account công ty) | Dùng account cá nhân để học |

## Tự kiểm tra
- [ ] Vào Console chỉ ra được: image ở đâu, revision nào đang nhận traffic, secret nào BE đang dùng.
- [ ] Rollback prod trong < 1 phút.
- [ ] Giải thích tại sao image FE có tag `dev-<sha>`, còn image BE chỉ có `<sha>`.
