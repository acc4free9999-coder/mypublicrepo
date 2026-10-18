# Cấu trúc một ngày / Daily unit specification

Áp dụng cho lộ trình PDF mới trong [Roadmap.md](./Roadmap.md). [Index mới](./index.html) có 30 trang unit với trắc nghiệm và lab riêng, không chuyển đổi số ngày hoặc workbook cũ. Phần nguyên lý dài là mục tiêu biên soạn; hiện có [unit 04 mẫu mở rộng](./units/unit-04-reading.html), không tuyên bố mọi unit đã có độ sâu tương đương.

## A. Thẻ bài học / Unit contract

Mỗi unit cần có:

- Số ngày, tên Việt–Anh, chủ đề duy nhất và kiến thức tiên quyết.
- 2–4 kết quả đo được: “tính”, “đánh dấu”, “bác bỏ”, “giải thích”; không chỉ “hiểu”.
- Link đến trang PDF thực tế; ghi rõ hình/trang nào cần quan sát và câu hỏi khi xem.
- Công cụ: chart trống, annotation, calculator; indicator chỉ khi chủ đề yêu cầu.
- Sản phẩm phải nộp, thời lượng linh hoạt và tiêu chí đạt.

## B. Recall — 3 câu trước khi đọc

Một câu nhớ quy tắc, một câu giải thích, một câu áp dụng vào endpoint nhỏ. Không xem đáp án trước khi trả lời. Ghi mức tự tin để so sánh sau bài.

## C. Nguyên lý / Principles

Tối thiểu **4 nguyên lý riêng biệt**, không lặp lại một ý bằng nhiều câu:

| Thành phần | Yêu cầu |
|---|---|
| Khái niệm / Definition | Giải thích bằng tiếng Việt; đoạn English tương ứng, không chỉ dịch tiêu đề |
| Cơ chế / Reasoning | Vì sao quan trọng khi đếm/vẽ/kiểm tra |
| Phạm vi / Scope | Pattern nào, degree nào, cần biết những điểm nào |
| Loại phát biểu | Hard rule, guideline, heuristic của sách hoặc trading policy |
| Phản ví dụ / Counterexample | Một trường hợp nhìn giống nhưng không đủ điều kiện |
| Checkpoint | Một câu hỏi ngắn để học viên tự kiểm tra ngay |

Mục tiêu biên soạn khoảng 80–150 từ mỗi ngôn ngữ cho một nguyên lý phức tạp; ưu tiên đủ lập luận hơn đếm từ. Không sao chép đoạn sách hoặc hứa biết chính xác đỉnh/đáy.

## D. Hình minh họa / Visual examples

Mỗi unit có tối thiểu:

1. **Hình mới A — supported candidate:** labels, endpoints, hướng, đơn vị và điều chưa kiểm chứng.
2. **Hình mới B — invalid/ambiguous:** đổi một yếu tố có ý nghĩa; nêu chính xác quy tắc thất bại hoặc evidence thiếu.
3. **Chart XAUUSD thật:** tệp/timeframe/timestamps/cutoff; phân biệt marks quan sát với nhãn Elliott suy luận.

Hình A/B là synthetic, không gắn logo/đường giá để làm người đọc tưởng là dữ liệu thật. Bản HTML hiện tại đặt **trích hình PDF có attribution và hai câu hỏi endpoint** làm ví dụ chính; sơ đồ synthetic bổ sung nằm trong phần mở rộng, không tuyên bố mỗi unit đã có đủ cặp supported/invalid chuyên sâu. Unit 04 có cặp hình trong bài đọc dài. Với RSI phải giữ cả price và oscillator; không suy đoán settings của ảnh sách, lab riêng ghi rõ RSI14 Wilder.

### D1. Học và trả lời ngay trên hình nguồn

1. Ghi tác giả, Image, trang PDF và link mở toàn trang; giữ axes/labels cần thiết.
2. Giảng ba bước Việt–Anh: quan sát gì → suy luận theo rule/guideline/policy nào → điều gì chưa được chứng minh.
3. Hai câu riêng yêu cầu chọn endpoint/anchor trên hình, không chỉ câu hỏi chung bên ngoài ảnh.
4. Click hoặc nhập tọa độ X/Y chuẩn hóa 0–1000 (gốc trên trái); kiểm tra, hiện vùng đáp án và giải thích; xóa để làm lại.
5. Thay điểm phải xóa feedback cũ. Chưa chọn hoặc tọa độ sai phải báo rõ, không trả kết quả pass.
6. Điểm được lưu cùng workbook ở answers 11–12; export review gồm nguồn/crop, câu hỏi, target và điểm chọn. Đây là luyện tập offline, không giấu đáp án chống gian lận.
7. Chấm vị trí chỉ xác nhận đọc đúng vùng được hỏi, không xác nhận count hay trade. Hai ảnh lặp cho hai câu lưu điểm độc lập; một hình có thể dùng lại ở nhiều unit với mục đích khác.

## E. Ví dụ giải từng bước / Worked reasoning

1. Liệt kê thứ biết được tại cutoff; không dùng chart bên phải.
2. Bảng `label | candle timestamp | high/low | price | degree`.
3. Tính distances/retracements/projections bằng công thức và anchors rõ ràng.
4. Kiểm tra từng hard rule, ghi `pass / fail / undecidable`.
5. Phân loại guideline riêng, không biến Fib/RSI thành luật.
6. Kết luận có giới hạn: “chưa phát hiện vi phạm giá” khác “count đúng”.
7. Cho một thay đổi endpoint hoặc bối cảnh và làm lại quyết định.

## F. Tự làm trên dữ liệu thật / Independent chart lab

Học viên chọn mẫu theo tiêu chí đã ghi trước, không lựa sau khi biết kết quả:

- Quan sát Daily → H4 → H1 ở cùng as-of point.
- Vẽ swings trước, rồi mới gán labels theo degree.
- Ghi primary, alternate hoặc no-count; đánh dấu invalidation.
- Lưu ảnh và review JSON trước reveal.
- Mở thêm nến theo số cố định, ví dụ từng nến hoặc 5 nến.
- So sánh kết quả nhưng không xóa bản gốc.
- Nếu dữ liệu không đủ tìm pattern, nộp search log và evidence thiếu; không ép count.

Mỗi unit có quota riêng trong roadmap. Không coi một chart 96 nến là đủ để tìm mọi pattern hiếm.

## G. Kiểm tra — 10 câu / Question bank

| Câu | Dạng |
|---|---|
| 1–2 | Khái niệm và phân biệt thuật ngữ |
| 3–4 | Tính toán/anchor hoặc phân loại endpoint |
| 5–6 | Tìm lỗi trên hình đúng/sai hoặc phản ví dụ |
| 7–8 | Tự vẽ/giải thích trên XAUUSD thật |
| 9 | Alternate và invalidation |
| 10 | Quyết định no-count/no-trade hoặc kiểm soát hindsight |

Mỗi đáp án gồm: kết luận → cách lập luận → lỗi thường gặp → dữ liệu còn thiếu. Đáp án chart là rubric, không phải một count duy nhất. Mỗi câu phải có nội dung Việt–Anh và phần trả lời trống trước phần lời giải.

Trong bản HTML tương tác hiện tại: 6 câu trắc nghiệm về chủ đề/cách đo/nhận diện, tiếp theo 4 nhiệm vụ tự luận/vẽ ngay cùng trang. Trắc nghiệm được chấm và giải thích; bài vẽ dùng checker giới hạn và rubric, không tự chấm đúng/sai toàn bộ cấu trúc. Bài đọc mẫu unit 04 giữ thêm 10 câu tự luận riêng.

Ngoài 10 slot cũ, mỗi unit có **hai câu trực tiếp trên hình nguồn** ở slots 11–12. Không cộng hai câu đọc hình thành điểm trắc nghiệm 8/8 hoặc coi chúng thay thế bài thực hành độc lập.

## H. Sửa bài / Correction loop

Giữ ba trạng thái: `original` → `feedback` → `revised`. Với mỗi sửa đổi ghi:

```text
Endpoint/time:
My original label and reason:
Observed price evidence:
Hard rule / guideline / unresolved evidence:
Revised label or reason to remove label:
Alternative still possible:
One thing to check next time:
```

Phản hồi tự động chỉ chấm điều kiện mà công cụ thực sự kiểm tra được. Nhận xét trong chat cần ảnh đủ rõ và review JSON; không đoán giá từ ảnh nhỏ hoặc khẳng định cấu trúc con không nhìn thấy.

## I. Nộp bài / Submission

```text
Unit/version:
PDF reading pages:
Source file / symbol / timeframe:
Visible cutoff / server-time offset known?:
Primary count / degree:
Alternate or no-count reason:
Endpoint table:
Rule audit:
Measurements:
Invalidation:
Hypothetical plan or no-trade:
Original image + review JSON:
Written answers 1–10:
Source-chart answers 11–12 (exercise ID + normalized x/y):
Feedback received:
Revised image + change log:
```

Nếu chưa biết contract specs, bid/ask hoặc costs: giữ phân tích cấu trúc; không tạo position size hay performance claim.

## J. Đạt bài / Pass gate

- 8/10 câu kiểm tra, có giải thích chứ không chỉ chọn đáp án.
- ≥16/20 điểm chart rubric trong [roadmap](./Roadmap.md).
- Không còn critical error về hard rules, tương lai, thông số broker hoặc fills.
- Tự diễn đạt được một điều còn chưa biết.
- Có bản vẽ gốc và bản sửa, hoặc giải thích rõ vì sao không cần sửa.

## K. Khuôn xuất bản / Publishing layout

Thứ tự HTML hiện tại: contract/outline → trích hình PDF và ba bước giảng → hai câu trên hình → sơ đồ bổ sung → sáu trắc nghiệm → lab MT5 độc lập → bốn tự luận → rubric/nhật ký/nộp bài. Recall và phần nguyên lý dài trong đặc tả vẫn là mục tiêu biên soạn, không giả định đã có đầy đủ trên mọi trang.

Tiêu đề và đoạn văn Việt–Anh đặt cạnh nhau trên màn hình rộng, xếp dọc trên mobile. Giá trị số, labels, source identity và tiêu chí đạt phải giống nhau giữa hai ngôn ngữ. Khi in/PDF cần giữ hình, bảng và câu trả lời, không chỉ in danh sách tiêu đề.
