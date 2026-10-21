# 04 — Góc nhìn Technical Architect (Ngày 2, chiều)

TA không cần gõ YAML nhanh nhất — TA cần **trả lời được "tại sao"**, thấy **rủi ro**, và **đề xuất cải tiến** có trade-off rõ ràng.

## 1. Các quyết định trong project này & trade-off

| Quyết định | Lý do | Cái giá / phương án khác |
|---|---|---|
| **WIF** thay JSON key | Không có secret dài hạn để lộ; giới hạn theo repo/branch | Setup phức tạp hơn lúc đầu |
| **Build once, deploy many** cho BE (tag theo SHA) | Thứ chạy ở prod chính là thứ đã test | Merge commit tạo SHA mới → vẫn build lại; muốn tuyệt đối thì *promote* image theo digest giữa các env |
| **FE build riêng từng env** | `NEXT_PUBLIC_*` bị inline lúc build | Image test ≠ image prod. Cách khác: runtime config (FE gọi `/api/config` hoặc đọc env ở server component) → 1 image cho mọi env |
| **Migration bằng Cloud Run Job trước deploy** | Không chạy migration lúc app khởi động (N instance cùng migrate = tranh chấp) | Migration phá vỡ (drop/rename cột) sẽ làm bản cũ đang chạy lỗi → cần pattern *expand/contract* |
| **1 Cloud SQL / 3 DB** | Rẻ để học | Công ty: prod nên **instance riêng**, tốt nhất **project riêng** (cô lập IAM, quota, billing) |
| **Secret Manager** cho `DATABASE_URL` | Không lộ trong GitHub, có version, có audit | Có thể dùng IAM DB auth / Cloud SQL Connector để bỏ hẳn password |
| **Cloud Run public (`--allow-unauthenticated`)** cho BE | Đơn giản, bảo vệ bằng Firebase token | Có thể đặt sau Load Balancer + Cloud Armor (WAF), hoặc FE gọi BE qua mạng nội bộ |
| **Tag + manual approval** cho prod | Có người chịu trách nhiệm, có điểm dừng | Chậm hơn continuous deployment |

## 2. Migration an toàn: pattern Expand → Migrate → Contract
Ví dụ đổi tên cột `title` → `name`:
1. **Expand** (release 1): thêm cột `name`, code ghi cả 2 cột, đọc `title`
2. **Migrate**: backfill dữ liệu `name = title`
3. Release 2: code đọc `name`
4. **Contract** (release 3): drop `title`

Mỗi bước an toàn để rollback code. Đây là câu hỏi phỏng vấn/thiết kế rất hay gặp.

## 3. Checklist soi project của công ty (mang theo khi đọc repo thật)

**Pipeline**
- [ ] Trigger cho từng env là gì? (branch? tag? manual?) Ai có quyền deploy prod?
- [ ] CI chạy những gì? Có test thật không hay chỉ build? Thời gian CI bao lâu?
- [ ] Có branch protection / required checks không?
- [ ] Image có tag theo SHA không, hay `latest`? (`latest` = không truy vết, không rollback chuẩn)
- [ ] Prod dùng lại image đã test hay build lại?
- [ ] Deploy có smoke test / health check sau khi lên không?

**Bảo mật**
- [ ] Auth GCP bằng WIF hay JSON key trong GitHub Secrets? (nếu key → đề xuất chuyển WIF)
- [ ] Service account có bị cấp `Owner`/`Editor` không? (rất hay gặp, nên thu hẹp)
- [ ] Secret để ở đâu? Có secret nào commit vào repo không? (`git log -p | grep -i password`)
- [ ] BE verify Firebase token ở mọi endpoint chưa, có endpoint nào quên guard?
- [ ] Prod và dev dùng chung Firebase project / DB không?

**Database**
- [ ] Migration chạy lúc nào, bởi ai? Có ai từng sửa schema tay trên prod không?
- [ ] Backup tự động + point-in-time recovery bật cho prod chưa? Đã từng *thử restore* chưa?
- [ ] Prod Cloud SQL có HA (regional) không?
- [ ] Connection pool: Cloud Run scale nhiều instance × pool size có vượt `max_connections` không?

**Vận hành**
- [ ] Rollback thế nào, mất bao lâu, đã tập chưa?
- [ ] Log/alert ở đâu (Cloud Logging, Error Reporting, uptime check)?
- [ ] `min-instances` prod = ? (0 = cold start vài giây cho user đầu tiên)
- [ ] Chi phí hàng tháng từng env?

## 4. Lộ trình cải tiến bạn có thể đề xuất (theo độ ưu tiên)
1. **WIF** thay JSON key (nếu chưa có) — rủi ro bảo mật cao nhất
2. **Required checks + tag SHA + smoke test** — chặn lỗi lên prod
3. **Tách project prod** + least-privilege SA
4. **Path filters** (`dorny/paths-filter`) — sửa FE không build BE → CI nhanh hơn
5. **Preview environment cho mỗi PR** (Cloud Run `--tag pr-123 --no-traffic`)
6. **Canary/gradual rollout**: deploy `--no-traffic`, rồi `update-traffic --to-latest=10` → 50 → 100
7. **Security scan**: `npm audit`, Trivy/Artifact Analysis quét image, Dependabot
8. **IaC (Terraform)** thay script gcloud — hạ tầng có review, có lịch sử, tái tạo được
9. **E2E test (Playwright)** chạy trên env test sau deploy

## 5. Câu hỏi tự luyện (trả lời miệng như đang họp)
1. Dev push code lên `develop`, 8 phút sau có trên dev. Kể chi tiết điều gì xảy ra trong 8 phút đó.
2. Deploy prod xong thì lỗi 500 hàng loạt. Bạn làm gì trong 5 phút đầu?
3. Tại sao không để app NestJS tự chạy `prisma migrate deploy` lúc start?
4. Một bạn dev muốn lưu `DATABASE_URL` prod vào GitHub Secrets cho tiện. Bạn phản hồi thế nào?
5. Làm sao để image prod chắc chắn giống y image đã QA ở test?
6. Firebase `apiKey` lộ trên FE có sao không? Thứ gì mới thật sự bảo vệ API?
7. Cloud Run scale lên 50 instance, DB báo "too many connections". Nguyên nhân & cách xử lý?
8. CI mất 15 phút, team phàn nàn. Bạn tối ưu thế nào?
9. Muốn mỗi PR có 1 link preview riêng để QA test — thiết kế ra sao?
10. Khi nào nên tách mỗi môi trường ra 1 GCP project?

<details>
<summary>Gợi ý trả lời ngắn</summary>

1. Trigger push → CI (typecheck/test/build/docker) → WIF auth → build+push image → Cloud Run Job migrate → deploy BE (revision mới, traffic chuyển khi healthy) → build+deploy FE → smoke test.
2. Rollback traffic về revision trước (`update-traffic`), *sau đó* mới điều tra log. Khôi phục dịch vụ trước, tìm nguyên nhân sau.
3. Nhiều instance cùng start → migrate song song; start chậm → Cloud Run health check fail; migration lỗi → app không lên được và khó thấy.
4. Không: secret prod chỉ nên ở Secret Manager, chỉ runtime SA đọc được; GitHub chỉ cần quyền deploy.
5. Promote cùng image digest giữa env, cấu hình qua env var; FE chuyển sang runtime config.
6. Không sao — nó chỉ định danh project. Bảo vệ thật là BE `verifyIdToken`, Authorized domains, phân quyền theo uid.
7. Mỗi instance mở pool riêng. Giới hạn `max-instances`, giảm `connection_limit` trong URL Prisma, dùng PgBouncer/Cloud SQL Managed Connection Pooling.
8. Cache deps + docker layer, path filters, chạy job song song, tách test chậm sang nightly.
9. Workflow on `pull_request` → deploy `--tag pr-<số> --no-traffic` → comment URL vào PR; dọn khi PR đóng.
10. Khi cần cô lập quyền (dev không chạm prod), tách billing, tránh quota/sự cố dev ảnh hưởng prod — gần như luôn nên với prod.
</details>
