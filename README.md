# Taskbar Overlay

Đây là một ứng dụng hiển thị trên Taskbar (thanh tác vụ) của Windows, cung cấp các tính năng tiện ích như xem Âm lịch, ngày Hoàng Đạo/Hắc Đạo, quản lý uống nước và nhắc nhở uống thuốc.

## Công nghệ sử dụng

Dự án này được xây dựng dựa trên các công nghệ sau:

1. **Electron (Phiên bản 28+)**:
   - Sử dụng làm framework chính để đóng gói ứng dụng web thành ứng dụng desktop chạy trên nền tảng Windows.
   - Ứng dụng tạo ra một cửa sổ ẩn (trong suốt) đè lên Taskbar để hiển thị thông tin.
   - **electron-builder** được sử dụng để đóng gói và tạo file cài đặt cho ứng dụng.

2. **Node.js**:
   - Là môi trường runtime bên dưới của Electron.
   - Sử dụng các module tích hợp như `fs` và `path` để thực hiện các thao tác đọc ghi dữ liệu cục bộ vào các file JSON (`pill_data.json`, `water_data.json`).

3. **HTML5, CSS3 & JavaScript (Vanilla JS)**:
   - Giao diện người dùng (UI) và logic xử lý chính của ứng dụng được viết hoàn toàn bằng HTML, CSS và JavaScript thuần (Vanilla JS), không sử dụng các framework UI phức tạp như React, Vue hay Angular.
   - CSS sử dụng Flexbox và các thuộc tính hiện đại để tạo giao diện nhỏ gọn, đẹp mắt và trong suốt.

4. **Thư viện Lunar.js**:
   - Sử dụng file `lunar.js` cục bộ để thực hiện các phép tính chuyển đổi giữa Dương lịch và Âm lịch.
   - Hỗ trợ tính toán tử vi, phong thủy, can chi, ngày giờ Hoàng Đạo / Hắc Đạo.

5. **VBScript & Batch Script**:
   - Sử dụng `start-silent.vbs` và `start.bat` để hỗ trợ việc khởi chạy ứng dụng một cách hoàn toàn im lặng (chạy ngầm, không hiện cửa sổ console) khi Windows khởi động.

6. **JSON**:
   - Sử dụng định dạng JSON để lưu trữ dữ liệu người dùng tại chỗ (Local storage qua file) như trạng thái uống thuốc và lượng nước uống hàng ngày.
