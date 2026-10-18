# Elliott Waves Made Simple — học theo chương PDF

Mở [index.html](./index.html). Khóa hiện tại bám đúng **sáu chương** trong mục lục PDF Steve Sinclair, không còn cấu trúc 30 ngày hay bài thực hành MT5/XAUUSD.

## Nội dung

| Chương | Tên trong PDF | Trang PDF | Trắc nghiệm |
|---|---|---|---|
| I | Elliott Wave at First Glance | 9–12 | 6 câu |
| II | The Motive Phase | 13–27 | 10 câu |
| III | The Corrective Phase | 28–56 | 18 câu |
| IV | Elliott Wave Optimization | 57–76 | 12 câu |
| V | How to Trade with Elliott Wave | 77–90 | 16 câu |
| VI | Elliott Wave Application in Real Trades | 91–104 | 10 câu |

Introduction (7–8) và Conclusion (105) ở mục lục, không tự tạo thành chương mới. Tổng cộng **72 câu trắc nghiệm** mới, dựa trên nội dung sách. Mỗi câu có một đáp án, giải thích và trang PDF đối chiếu. Một số câu dẫn tới hình gốc được trích ngay trong chương.

- [Roadmap Markdown](./Roadmap.md) · [Roadmap HTML](./roadmap.html).
- [Cách học một chương](./unit-structure.html).
- [Bắt đầu chương I](./chapters/chapter-01.html).
- [PDF gốc bạn cung cấp](./data/Elliott-waves-made-simple-mast-steve-sinclair.pdf).

## Cách dùng

Đọc đúng khoảng trang → theo các mục con → xem hình liên quan → làm trắc nghiệm → chấm và đối chiếu lời giải. Tóm lược HTML là hướng dẫn đọc ngắn, không sao chép toàn bộ chương. Những chỗ sách không nhất quán có lưu ý riêng; câu hỏi không âm thầm thay quy ước nguồn bằng quy tắc của khóa cũ.

Lựa chọn tự lưu trong trình duyệt, riêng từng chương tại `elliott-pdf-chapters-v1:chapter-N`. Đổi lựa chọn xóa điểm chấm cũ. “Làm lại chương này” cần xác nhận, không đụng chương khác hay workbook cũ. “Tải câu trả lời JSON” lưu bản sao cùng đề, trang, đáp án và giải thích; hiện không có import JSON.

Lỗi đọc/lưu được báo rõ. Dữ liệu không khớp phiên bản không bị tự ghi đè. Với file URL, hành vi localStorage phụ thuộc trình duyệt; giữ cùng đường dẫn và tải bản sao khi cần. Bài offline không chống xem đáp án.

Không có chart MT5, replay, sizing worksheet hoặc quota vẽ trong khóa mới. Các policy entry/stop/target của sách được học như nội dung nguồn, không phải lời khuyên đặt lệnh. Điểm đọc hiểu không chứng nhận đếm sóng chính xác hoặc khả năng sinh lời.

## Xây dựng và kiểm tra

Không cần package hoặc dữ liệu MT5 để build:

```sh
node scripts/build-roadmap.mjs
node --test tests/pdf-curriculum.test.mjs tests/pdf-runtime.test.cjs
```

[pdf-chapters.mjs](./teaching/pdf-chapters.mjs) là nguồn chung cho thứ tự chương, các mục con, tóm lược và câu hỏi. [build-roadmap.mjs](./scripts/build-roadmap.mjs) xuất mục lục, roadmap, cấu trúc học và sáu trang chương. Không chỉnh trực tiếp các tệp sinh tự động.

Các trích hình đã chọn nằm trong [source-figures/](./units/source-figures/); [provenance.json](./units/source-figures/provenance.json) ghi trang, crop, kích thước và SHA-256 của nguồn/hình. Build xác minh nguồn và các hình được dùng. Nếu cần tạo lại hình trên macOS:

```sh
swift scripts/crop-pdf-charts.swift
node scripts/build-roadmap.mjs
```

Đây là trích hình để học/đối chiếu với nhận xét mới; giữ attribution Steve Sinclair, số Image và trang PDF. Quyền tác giả của hình/sách thuộc chủ sở hữu; không coi chúng là artwork do khóa học sở hữu hoặc tự suy ra quyền phân phối lại.

## Bản cũ được giữ riêng

[Index 30 unit cũ](./index-30day.html), [roadmap cũ](./roadmap-30day.md), [hướng dẫn cũ](./README-30day.md) và [legacy index](./legacy-index.html) vẫn tồn tại để giữ bài cũ. Các trang trong [units/](./units/) và [days/](./days/) không thuộc chương trình hiện tại; workbook và dữ liệu cũ không bị chuyển đổi.

Builder 30 unit được giữ tại [build-30day.mjs](./scripts/build-30day.mjs), chỉ dùng tài liệu roadmap cũ; builder khóa chương mới không import hoặc chạy nó. Bộ mở rộng chương giảng song ngữ cũ vẫn thiếu module như đã ghi trong hướng dẫn cũ; thay đổi này không sửa phần đó.
