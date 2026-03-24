# Helcim (nail-backend)

## Env

See `.env.example`: `HELCIM_API_TOKEN` (required), `HELCIM_TERMINAL_ID`, `HELCIM_WEBHOOK_SECRET`.

- **API token** = Integrations → API Access Configuration (header `api-token`). Not HelcimPay.js checkout tokens.
- **invoiceNumber** on Helcim init = existing Helcim invoice only; we omit it for normal POS (auto invoice).
- **customerCode** = existing Helcim customer only; optional JSON field **`helcimCustomerCode`** on `POST /api/helcim/checkout`.

## DB

After pulling model changes:

```bash
cd nail-backend && npm run db:alter
```

## Routes

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/helcim/webhook` | No (signature) |
| POST | `/api/helcim/checkout` | JWT |
| POST | `/api/helcim/terminal/charge` | JWT |
| POST | `/api/helcim/confirm` | JWT |
| POST | `/api/helcim/refund` | JWT |
| GET | `/api/helcim/terminal/status` | JWT |
| GET | `/api/helcim/transaction/:id` | JWT |
| GET | `/api/helcim/summary` | JWT |
| POST | `/api/receipt/sms` | JWT |

## POS app (nail-app)

- **Thẻ (Pay Card):** backend gọi Helcim **Payment Hardware API** [`POST /v2/devices/{code}/payment/purchase`](https://devdocs.helcim.com/reference/startpurchase) với header **`idempotency-key`** và body **`currency` + `transactionAmount`**. **`HELCIM_TERMINAL_ID`** phải là **device / pairing code** (thường hiện trên máy sau khi bật pairing mode), không nhất thiết là số ID khác trong dashboard. Kiểm tra danh sách thiết bị: `GET /v2/devices/` (header `api-token`). Pairing: [Using the Helcim Smart Terminal API](https://learn.helcim.com/docs/using-the-helcim-smart-terminal-api). App: `POST /api/helcim/terminal/charge` → poll `GET /api/helcim/transaction/:id` khi có `transactionId`.
- Tùy chọn dev: **`EXPO_PUBLIC_HELCIM_PAY_HOSTED_PAGE`** chỉ còn ý nghĩa nếu tái tích hợp Pay.js riêng.
- Số tiền: `amount` = `getCardFeeBase()` (Subtotal + Tax cửa hàng − Discount), `taxEnabled: true` → Helcim cộng thêm 3% trên `amount`, `tips` = tip — khớp tổng **Card** trên vé.
- Sau **SUCCESS**, app ghi nhiều dòng `POST /api/transactions`; chỉ **dòng đầu** có `helcimTransactionId` (unique) để refund khớp một lần quẹt.

## Lịch sử trong app vs lịch sử Helcim (portal)

- **POS** (`GET /api/transactions`) = giao dịch trong **database salon**. Hiển thị trên màn POS / báo cáo nội bộ.
- **Helcim Dashboard** (Transactions / Payments trên helcim.com) = chỉ các lần **Helcim thực sự xử lý tiền** (Pay.js hoàn tất, Smart Terminal, v.v.).
- **`EXPO_PUBLIC_POS_TEST_PAY=1` trong nail-app:** thanh toán **Card** không gọi Helcim — vé ghi DB với `paymentMethod: card` nhưng **không** có `helcimTransactionId`. Sẽ **không** thấy giao dịch đó trong portal Helcim. Muốn khớp portal: **tắt** `POS_TEST_PAY`, dùng token Helcim đúng môi trường (test vs live), thanh toán qua Pay.js đến khi SUCCESS.
- **Tiền mặt (Cash):** không đi qua Helcim — bình thường là không có trong lịch sử thẻ Helcim.

## reCAPTCHA / lỗi WebView (`Could not validate ReCaptcha`)

- Nếu vẫn lỗi sau khi dùng trang `helcim-pos-pay.html`: trong **Helcim Dashboard**, cấu hình **HelcimPay.js / Integrations** gắn với API token — thử **tắt Require Captcha** (hoặc thêm domain/host của backend vào cấu hình reCAPTCHA nếu Helcim hỗ trợ).
- Đảm bảo thiết bị mở được `{API_URL}/helcim-pos-pay.html` (firewall, cùng mạng LAN).

### WebView trắng / không thấy form

- **Token `t=`** phải là `checkoutToken` từ `POST /api/helcim/checkout` (thường **≥ 18 ký tự**). Mở tay URL kiểu `?t=lksadsa` sẽ **không** mở form — trang sẽ báo lỗi token ngắn.
- **Chrome (thử trên trình duyệt):** nếu thanh địa chỉ báo **Third-party cookies blocked** → bật cho phép cookie cho site `192.168…` / domain backend; Helcim iframe + reCAPTCHA cần cookie bên thứ ba.
- Trang `helcim-pos-pay.html` có ô **“Không thấy form?”** (cookie / token / Captcha). Trong **React Native WebView** vẫn ép iframe full viewport + gỡ `transform` trên cha; trên **Chrome** không ép iframe để khỏi vỡ layout modal.
- Nếu thấy **“Mở form thanh toán…”** mà vẫn trống: thường là **reCAPTCHA** — trong Helcim Dashboard tắt **Require Captcha** cho Pay.js gắn API token.
- Trang host **HTTP** (LAN) vẫn tải `start.js` qua HTTPS; production nên **HTTPS** nếu trình duyệt chặn nghiêm hơn.

### `secure.helcim.app refused to connect` (trong WebView / iframe)

- Thường xảy ra khi **trang cha** là `http://192.168.x.x/helcim-pos-pay.html` — Helcim / trình duyệt có thể **không cho iframe** từ origin đó.
- **Mặc định nail-app** dùng **HTML nhúng** trong WebView với `baseUrl: https://secure.helcim.app` (không mở URL LAN làm trang gốc). Chỉ dùng trang hosted khi bật `EXPO_PUBLIC_HELCIM_PAY_HOSTED_PAGE=1` **và** backend có **HTTPS + domain** đã thêm trong cấu hình Helcim Pay.js (allowed website / origins).
- Kiểm tra máy **không chặn** outbound tới `secure.helcim.app` (firewall, DNS, VPN).

## Test

- Dùng **API token** từ môi trường **test/sandbox** trong Helcim (Integrations → API Access). Thẻ test: xem [Helcim dev docs](https://devdocs.helcim.com/) mục Testing.

```bash
npm run test:helcim
```
