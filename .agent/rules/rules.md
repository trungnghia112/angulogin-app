# Operational Rules

## 1. Memory Trigger
Khi prompt bắt đầu bằng "Hãy ghi nhớ:", trích xuất thông tin và cập nhật ngay lập tức vào:
- Serena memories
- `AGENTS.md`
- `.gemini/GEMINI.md`

## 2. Mandatory Build
LUÔN LUÔN chạy `npm run build` để kiểm tra lỗi sau các bước viết code.
- Fix tất cả `[WARNING]` logs

## 3. Commit Policy
Commit sau mỗi bước hoàn thành:
- **Ngôn ngữ**: Tiếng Anh
- **Format**: Semantic Commit (`feat`, `fix`, `refactor`, `chore`)
- **Command**: `git add -A && git commit -m "type: description"`

## 4. Communication
Phản hồi bằng ngôn ngữ của người dùng:
- Tiếng Việt <-> Tiếng Việt
- English <-> English

## 5. Execution Flow
- Thực hiện các bước **tuần tự**
- **KHÔNG** dừng lại để hỏi "tiếp tục?"
- **Tự động thử lại** khi gặp lỗi

## 6. Smart Versioning
Kiểm tra `package.json` và áp dụng cú pháp đúng version:

| Package | Version | Syntax |
|---------|---------|--------|
| Angular | v21+ | `@if`, `@for`, `@switch`, standalone default |
| Tailwind | v4+ | CSS variables, `@theme` directive |
| TypeScript | v5.9+ | Strict mode |