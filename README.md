# FilmCloudflare 1.0

Website xem video MP4, tự động liệt kê object từ Cloudflare R2 bucket `lol`.

## Kiến trúc

- GitHub: lưu mã nguồn và tự động kích hoạt deploy.
- Cloudflare Workers Static Assets: hosting website.
- Cloudflare Worker: API `/api/videos`.
- Cloudflare R2: bucket `lol`, binding `MOVIES`.
- Public R2 development URL: dùng để phát video MP4 trực tiếp.

## Tính năng

- Tự động liệt kê tất cả object `.mp4` trong bucket.
- Phân trang R2 (tối đa 1.000 object mỗi lần gọi).
- Tìm kiếm theo tên/đường dẫn.
- Sắp xếp video mới cập nhật.
- Phát MP4, tua, âm lượng, toàn màn hình qua HTML5 video.
- Giao diện responsive cho desktop và điện thoại.
- Không cần lưu video trên GitHub.
- Không cần R2 Access Key/Secret Key trong source code.

## 1. Cấu hình Cloudflare

Dự án đã khai báo:
- R2 bucket binding: `MOVIES`
- Bucket name: `lol`
- Static assets: `./public`
- Public base URL: `https://pub-bcb05d8d57194ba6a78a0578c483da08.r2.dev`

Trong Cloudflare Dashboard:
1. Vào Workers & Pages.
2. Deploy Worker này từ GitHub hoặc GitHub Actions.
3. Kiểm tra Worker có R2 binding `MOVIES` trỏ đến bucket `lol`.
4. Đảm bảo Public Development URL đang bật nếu tiếp tục dùng endpoint `r2.dev`.
5. Không chia sẻ R2 API token hoặc Cloudflare API token.

`r2.dev` phù hợp thử nghiệm, không được khuyến nghị làm endpoint production. Khi vận hành thật, tạo Custom Domain cho R2 rồi cập nhật `PUBLIC_R2_BASE_URL` trong `wrangler.jsonc`.

## 2. Đẩy source lên repository GitHub

Repository đích:
`https://github.com/vietlinhn25-cyber/FilmCloudflare`

Giải nén ZIP, mở terminal tại thư mục `FilmCloudflare`, chạy:

```bash
git init
git branch -M main
git add .
git commit -m "Build FilmCloudflare 1.0"
git remote add origin https://github.com/vietlinhn25-cyber/FilmCloudflare.git
git push -u origin main
```

Nếu thư mục đã là Git repository, không chạy `git init` và `git remote add` lần nữa. Kiểm tra `git remote -v`, sau đó `git add .`, `git commit`, `git push`.

## 3. Thiết lập GitHub Actions secrets

Trong GitHub repository:
Settings → Secrets and variables → Actions → New repository secret.

Tạo hai secrets:

- `CLOUDFLARE_API_TOKEN`: Cloudflare API Token có quyền deploy Workers (Workers Scripts Edit và quyền Account phù hợp).
- `CLOUDFLARE_ACCOUNT_ID`: Account ID của tài khoản Cloudflare.

Không đặt token vào file source code, commit hoặc gửi trong chat.

## 4. Deploy

Sau khi thêm hai secrets, vào tab Actions của GitHub. Workflow `Deploy FilmCloudflare` sẽ chạy khi push lên branch `main`.

Có thể deploy thủ công từ máy tính:

```bash
npm install
npx wrangler login
npm run check
npm run deploy
```

Sau khi deploy, website có dạng:
`https://filmcloudflare.<your-workers-subdomain>.workers.dev`

## 5. Kiểm tra API

Mở:

- `/api/health` — kiểm tra Worker.
- `/api/videos` — lấy trang video đầu tiên.
- `/api/videos?limit=1000` — lấy tối đa 1.000 object MP4.
- `/api/videos?cursor=<cursor>` — lấy trang tiếp theo.

## 6. Cách đồng bộ

Website gọi API Worker. Worker dùng R2 binding `MOVIES.list()` để đọc object keys. Các key kết thúc bằng `.mp4` được chuyển thành URL công khai dựa trên `PUBLIC_R2_BASE_URL`.

Không phải tải lại video hoặc tạo danh sách thủ công. Video mới được thêm vào R2 sẽ xuất hiện sau khi người dùng làm mới website.

## 7. Lưu ý quan trọng

- Public nghĩa là người có URL video có thể xem/tải video. Không dùng cho nội dung riêng tư.
- Chỉ phân phối video mà bạn có quyền lưu trữ và phát hành.
- R2 listing trả metadata object, không tự sinh thumbnail/poster.
- Video MP4 cần được encode tương thích trình duyệt. HTTP Range cần được endpoint R2 hỗ trợ để tua mượt.
- `r2.dev` là development URL; dùng Custom Domain cho production.
- Phiên bản này chỉ liệt kê/phát MP4. Chưa có tài khoản người dùng, admin upload, HLS/transcoding, DRM hoặc quản lý bản quyền.
