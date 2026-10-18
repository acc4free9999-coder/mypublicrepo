# Elliott Wave: lộ trình 30 ngày / 30-day learning roadmap

**Phiên bản thiết kế:** PDF-based curriculum, 18-10-2026 — hình nguồn và câu hỏi trực tiếp trên chart. Mỗi ngày = một unit; học lại nếu chưa đạt, không bắt buộc hoàn thành trong 30 ngày lịch.

**Nguồn chính:** Steve Sinclair, [Elliott Waves Made Simple](./data/Elliott-waves-made-simple-mast-steve-sinclair.pdf), 105 trang PDF. Số trang dưới đây là **vị trí trang trong tệp PDF, tính từ 1**, kể cả bìa; không phải số trang in. Bấm liên kết để xem hình và ví dụ gốc trong bản sách bạn đã cung cấp. Một số trình đọc không hỗ trợ fragment `#page=`, khi đó nhập số trang thủ công.

**Cách sử dụng sách:** đọc có phản biện, không học thuộc mọi phát biểu như quy luật thị trường. HTML dùng **19 trích hình chart/sơ đồ được chọn từ PDF bạn cung cấp**, có ghi Steve Sinclair, số Image và trang gốc. Lời giảng, câu hỏi và phản hồi được soạn mới để phân tích/phản biện từng hình; không tái bản nguyên chương hoặc toàn bộ lời giải. Giữ nguồn và quyền tác giả khi sử dụng; không coi các trích hình là nội dung mới do khóa học sở hữu.

**Kết quả kỳ vọng / Outcome:** tự chọn swing, vẽ giả thuyết sóng, kiểm tra quy tắc, giữ phương án thay thế và kiểm thử kế hoạch trên dữ liệu lịch sử. Không hứa thành chuyên gia, đoán đúng mọi sóng hoặc có lợi nhuận sau 30 ngày.

## 1. Thiết kế mới thay đổi gì?

- Đi từ đọc chart → motive → corrections → công cụ hỗ trợ → kế hoạch → kiểm chứng. Không học Fibonacci như cách thay thế cấu trúc sóng.
- Tách riêng **extensions**, **leading diagonal**, **ending diagonal**, **ba loại flat**, **các biến thể triangle**, **RSI divergence**, **sóng 3/5/C** thay vì gộp quá nhiều trong một ngày.
- Phân biệt ba lớp bằng chứng: **hình sách**, **hình vẽ mới để giải thích**, **nến XAUUSDm thật để tự thực hành**. Không coi ảnh sách là dữ liệu MT5 của bạn.
- Mỗi unit theo [cấu trúc chuẩn](./Unit-structure.md); xem [unit 04 hoàn chỉnh làm mẫu](./units/unit-04.md).
- Mở **[index HTML mới](./index.html)** để vào 30 trang unit riêng. Mỗi unit đi theo thứ tự **đọc nguyên lý → đọc hình gốc có lời giảng → 2 câu bấm endpoint trên hình → 6 trắc nghiệm → tự vẽ XAUUSDm và 4 câu tự luận**. Toàn khóa có 60 câu hỏi hình, 180 trắc nghiệm và 120 nhiệm vụ tự luận/vẽ. Câu hỏi và lời giải mới, không phải bộ bài tập của tác giả.
- [Unit 04 HTML](./units/unit-04.html) có thêm [bài đọc chi tiết mở rộng](./units/unit-04-reading.html). Các unit khác có nội dung đọc từ roadmap và PDF, không tuyên bố đã có toàn bộ chương giảng song ngữ dài như bài mẫu.
- Các trang trong [days/](./days/) và [index khóa cũ](./legacy-index.html) vẫn thuộc trình tự HTML trước đó; chưa đổi tên hoặc chuyển bài làm cũ sang các ngày mới. Không dùng số ngày của HTML cũ để xác định unit mới.

## 2. Bản đồ đọc sách / Source map

| Phần nguồn | Trang PDF | Đưa vào khóa học |
|---|---|---|
| Chu kỳ, cấu trúc lồng nhau | 9–12 | Unit 1–3 |
| Impulse và extensions | 13–21 | Unit 4–7 |
| Leading / ending diagonal | 21–27 | Unit 8–9 |
| Zigzag và flats | 28–39 | Unit 11–13 |
| Triangles | 39–46 | Unit 14–15 |
| Double / triple three | 46–56 | Unit 16 |
| Fibonacci | 57–61 | Unit 18–20 |
| High/low, chart patterns, RSI | 62–76 | Unit 2, 21–22 |
| Kế hoạch sóng 3, 5, C; hai cách tiếp cận | 77–90 | Unit 23–27 |
| Các ví dụ giao dịch của tác giả | 91–104 | Unit 28–29, đọc lại theo kiểu che tương lai |
| Tổng kết | 105 | Unit 30 và kế hoạch học tiếp |

Unit 10, 17, 24 và 30 bổ sung kiểm tra, quản trị rủi ro và phương pháp học. Các phần đó là thiết kế của khóa học, không phải chương mới của sách.

### Hình nguồn ngay trong bài / Embedded source-chart map

| Unit | Trang PDF / Image | Mục đích quan sát và câu hỏi |
|---|---|---|
| 01 | 10 / 1 | Cuối motive 5 và cuối corrective C |
| 02, 06–07 | 21 / 10 | Gold Daily: wick, degree, wave 1 extension, so 1/3/5 |
| 03–05, 10 | 15 / 5 | Impulse cha/con, origin, wave 2 và overlap 1/4 |
| 08 | 24 / 12 | Leading diagonal giảm, biên wave 1 và wave 4 |
| 09, 21 | 26 / 14 | Ending diagonal, phân biệt 4 cha và (iv) con |
| 11 | 30 / 16 | Zigzag: endpoints A/B và 5–3–5 |
| 12, 17 | 34 / 20 | Regular flat: gốc A, B, C và 3–3–5 |
| 13 | 36 / 22 + 38 / 24 | So expanded/running flat theo vị trí C so với A |
| 14 | 45 / 31 | Contracting triangle: A và E |
| 15 | 46 / 32 | Gold H4 running triangle: B overshoot và E |
| 16 | 52 / 36 | Triple three: Y và connector X thứ hai |
| 18 | 59 / 40 | Hai wick neo retracement, không nhầm với projection |
| 19, 23–24, 27 | 79 / 58 | Ba anchors projection; entry, origin/stop, targets và policy |
| 20 | 81 / 59 | Quan hệ sóng và wave 5 dự phóng |
| 22 | 73 / 54 | Hai panel price/RSI, lower low và higher low |
| 25, 29 | 97 / 70 | USD/MXN: wave 3/4, anchors, policy và hindsight |
| 26 | 89 / 63 | Wave C: B, target và tổng risk của nhiều entry |
| 28, 30 | 91 / 64 | USD/CHF: audit nguồn; tách nến thật với đường dự phóng |

Ảnh giữ nhãn tác giả: đây là **bài đọc hình có hướng dẫn**, không phải bài thi dự đoán mù. Câu hỏi bấm vào endpoint giá, không vào chữ nhãn. Chấm theo vùng dung sai, hiện vùng đáp án và giải thích sau khi kiểm tra; có thể dùng tọa độ X/Y 0–1000 thay chuột. Hai câu mỗi unit lưu ở answers 11–12; 1–10 cũ giữ nguyên. Save/reload/import và review JSON giữ identity câu, nguồn, crop, tọa độ và đáp án để sửa trong chat. Điểm đọc hình tách khỏi điểm trắc nghiệm và rubric vẽ; bấm đúng không chứng nhận count đúng.

Ảnh sách không phải cửa sổ MT5 thực hành. Bài tự vẽ XAUUSDm độc lập giữ replay, cutoff và nguồn thật; nếu không có mẫu phù hợp thì nộp no-count/search log. Không dùng hình sách đã có nhãn làm bài thi blind cho unit 28–30.

## 3. Quy ước và điểm cần đọc có phản biện

| Vấn đề trong nguồn | Quy ước của khóa học |
|---|---|
| Trang 15–16 diễn đạt overlap theo “territory” của wave 2 | Với **standard impulse**, kiểm tra wave 4 có vào vùng giá wave 1 không. Ví dụ tăng: wave 4 phải ở trên đỉnh wave 1; kiểm tra cả râu nến. Khóa học bảo thủ coi chạm biên là cần loại/kiểm tra lại. |
| Trang 18 nói chỉ một sóng được mở rộng | Một extension nổi bật là mẫu thường gặp, không áp thành định luật tuyệt đối cho mọi thị trường hoặc mọi cấp sóng. Không chỉ đếm chín swing để kết luận. |
| Trang 21–27 trình bày diagonal giản lược | Kiểm tra vị trí, cấu trúc con và hình học; overlap không tự chứng minh diagonal. Leading diagonal có khác biệt quy ước giữa các tài liệu; ghi rõ dùng cách trình bày nào, không tự động chấm như impulse. |
| Trang 33–39 cho phép flat B hồi 78,6% trong forex | Dùng **90%** làm ngưỡng phân loại flat trong khóa học. 78,6% là biến thể tác giả cho phép, không phải quy tắc chung; XAUUSDm không tự động được hưởng ngoại lệ forex. |
| Trang 40 và 69 liệt kê vị trí triangle khác độ đầy đủ | Học wave 4, B và X trong ngữ cảnh phù hợp; không gán triangle độc lập làm toàn bộ wave 2. Phân biệt running triangle với running flat. |
| Trang 50–55 thêm quy tắc riêng và mẹo đếm bảy swing | Gắn nhãn “heuristic của tác giả”; bảy swing chưa xác nhận W-X-Y. Phải xem các thành phần điều chỉnh và cấp sóng. |
| Trang 60–61 nêu các khoảng Fibonacci | Là vùng quan sát/giả thuyết, không là hard rules. Wave 2 hồi dưới 38,2% không tự động vô hiệu chỉ vì tỷ lệ. |
| Trang 72–75 dùng RSI để củng cố count | Divergence là bằng chứng phụ; thiếu divergence không tự làm count sai, có divergence không chứng minh đảo chiều hoặc cấu trúc con. |
| Trang 77–90 có mô tả/tên sóng và cách tiếp cận chưa nhất quán | Khóa học gọi rõ giai đoạn chuẩn bị và sóng muốn tham gia: chờ wave 2 → kế hoạch wave 3; chờ wave 4 → wave 5; chờ B → C. |
| Trang 78, 84 nêu phần trăm rủi ro theo quy mô tài khoản | Không lấy các mức đó làm khuyến nghị. Dùng bài toán giả định và giới hạn tổng rủi ro đã định trước; không tăng rủi ro chỉ vì tài khoản nhỏ. |
| Trang 91–104 trình bày các ví dụ đã biết kết quả | Dùng để học cách lập luận, không suy ra tỷ lệ thắng. Phải bổ sung trường hợp thất bại, không khớp và không giao dịch. |
| Trang 60 nhắc phụ lục Fibonacci ở cuối | Bản PDF được cung cấp kết thúc ở trang 105; không có phụ lục riêng để giao đọc. Dùng công thức minh bạch ở unit 18–20. |

**Hard rule ≠ guideline ≠ trading rule.** Count không vi phạm quy tắc vẫn có thể là cách giải thích sai. Điều kiện hủy count cũng không đồng nhất với stop thực thi: spread, khoảng đệm và thanh khoản có thể làm hai mức khác nhau.

## 4. Dữ liệu thật và cách nộp bài

- Thực hành bằng [MT5 XAUUSDm](./data/Mt5Data/), ưu tiên **Daily → H4 → H1**. Không mặc định timeframe chính là degree.
- Chọn 80–150 nến H4 cho một nghiên cứu; dùng lịch sử rộng hơn khi thiếu cấu trúc. Mỗi ca ghi tên tệp, thời gian bắt đầu/kết thúc và nến cuối được phép nhìn.
- Chỉ mở nến đã hoàn thành ở mọi khung. Không dùng Daily/H4 đang chứa phần tương lai so với mốc H1.
- Giá và timestamp giữ nguyên nguồn. Chưa biết timezone server, bid/ask, contract size, tick value và chi phí. Không tự coi timestamp là UTC, không mặc định 100 oz/lot hoặc $10/pip.
- Đơn vị biến động: khoảng giá USD/oz; pip/point chỉ dùng sau khi xác minh đặc tả broker.
- Mỗi ca gồm: ảnh trước reveal → bảng endpoint/time/price → primary + alternate/no-count → invalidation → ảnh sau reveal → giải thích sửa.
- Trang unit mới có bài vẽ ngay trong bài, lưu dưới workbook `xauusd-pdf-v1` riêng biệt. Chọn đáp án rồi “Chấm trắc nghiệm”; viết giải thích và lưu trước khi rời trang. Điểm trắc nghiệm không tự chứng nhận bài vẽ đã đạt.
- Xuất review JSON và ảnh SVG từ bài mới, gửi vào chat để được nhận xét. Không có tự động gửi tới AI. Nếu dùng công cụ HTML cũ, mở theo **tên chủ đề**, không số ngày mới.
- Checker chỉ kiểm tra một số ràng buộc giá/thứ tự; không chứng nhận degree, internals, diagonal, complex correction hoặc hiệu quả giao dịch.

## 5. Cấu trúc một ngày / Daily unit

Một unit khoảng **90–120 phút**, có thể chia hai buổi. Không ép học xong khi chưa hiểu.

1. **Recall — 5 phút:** 3 câu ôn hôm trước, chưa mở đáp án.
2. **Read — 10 phút:** trang PDF cụ thể và nhiệm vụ xem hình.
3. **Principles — 20 phút:** tối thiểu 4 nguyên lý song ngữ, kèm lý do, điều kiện và phản ví dụ.
4. **See — 10 phút:** ít nhất 2 hình mới: đúng theo phạm vi kiểm tra / sai hoặc chưa đủ bằng chứng.
5. **Worked example — 15 phút:** đi từng endpoint, tính toán, kiểm tra và kết luận có giới hạn.
6. **Draw — 20–30 phút:** tự vẽ trên XAUUSD thật, chưa xem đáp án.
7. **Test — 15 phút:** 10 câu/bài: 6 trắc nghiệm có chấm/giải thích và 4 nhiệm vụ tự luận/vẽ. Bài mẫu unit 04 có thêm 10 câu tự luận mở rộng.
8. **Correct & submit — 10–15 phút:** lưu bản gốc, sửa bằng màu khác, ghi lý do, nộp review packet.

Chi tiết yêu cầu nội dung và rubric ở [Unit-structure.md](./Unit-structure.md). Bài tập cụ thể dưới đây là đầu bài cho từng unit; mỗi unit khi triển khai đầy đủ phải mở rộng thành 10 câu có giải thích, không chỉ một câu trắc nghiệm.

## 6. Lộ trình chi tiết / Thirty units

### Giai đoạn 1 — Đọc cấu trúc và kiểm tra impulse / Days 1–5

#### Day 01 — Chu kỳ 5–3 / Motive and corrective phases
- **Đọc:** [PDF 9–12](./data/Elliott-waves-made-simple-mast-steve-sinclair.pdf#page=9), xem hình chu kỳ và cấu trúc lồng nhau.
- **Mục tiêu:** phân biệt hướng giá, vai trò trong parent wave và nhãn giả thuyết.
- **Nguyên lý:** motive/corrective; nhãn 1–5 và A–B–C; quan sát khác diễn giải; không dự báo chắc chắn.
- **Ví dụ mới:** 2300→2340→2320→2390→2350→2410 rồi 2370→2390→2345. Vẽ hai pha, chưa khẳng định internals.
- **Bài tập:** giải thích vì sao ba đoạn cuối chưa đủ chứng minh zigzag; đảo chiều toàn bộ sơ đồ thành mẫu giảm.
- **XAUUSD:** chọn một H4 up-leg và một down-leg, chỉ tô vùng chuyển động/correction.
- **Đáp án định hướng:** zigzag cần kiểm chứng 5–3–5 ở cấp dưới; hướng lên không tự đồng nghĩa motive ở mọi degree.
- **Nộp/đạt:** 2 chart, phân biệt ít nhất 3 quan sát với 3 suy luận.

#### Day 02 — Swing và điểm bắt đầu / Swings and anchor selection
- **Đọc:** [PDF 62–64](./data/Elliott-waves-made-simple-mast-steve-sinclair.pdf#page=62), cách chọn turning point.
- **Mục tiêu:** chọn pivot nhất quán, không kéo điểm đầu để cứu count.
- **Nguyên lý:** wick/close; major/minor swing; pivot confirmation; ngữ cảnh trước điểm bắt đầu.
- **Ví dụ mới:** đỉnh ở nến 20 cần hai nến phải hoàn thành mới xác nhận theo quy ước luyện tập.
- **Bài tập:** nến nào sớm nhất biết pivot? Nếu nến 22 tạo đỉnh cao hơn, đánh giá lại ra sao?
- **XAUUSD:** 100 nến H4, đánh dấu swing không dùng số Elliott; ghi timestamp pivot và lúc xác nhận.
- **Đáp án định hướng:** sau close nến 22 và chỉ khi điều kiện vẫn đúng; không gán kiến thức đó cho nến 20.
- **Nộp/đạt:** bảng 10 pivot hoặc ghi thiếu mẫu; không dùng pivot trước khi biết.

#### Day 03 — Degree và cấu trúc con / Degree and subdivisions
- **Đọc:** [PDF 11–15](./data/Elliott-waves-made-simple-mast-steve-sinclair.pdf#page=11).
- **Mục tiêu:** tách parent wave với các sóng nằm bên trong.
- **Nguyên lý:** degree tương đối; H4 không phải tên degree cố định; kiểm chứng internals; cùng mốc thời gian.
- **Ví dụ mới:** một H4 up-leg chứa năm H1 legs, nhưng chưa biết nó là wave 1 hay A của parent.
- **Bài tập:** nêu hai cách gán vai trò khác nhau cho cùng năm legs; bằng chứng nào có thể phân biệt?
- **XAUUSD:** 1 bộ Daily/H4/H1, nối ít nhất 3 endpoint cùng timestamp.
- **Đáp án định hướng:** parent context và diễn biến tiếp theo giúp phân biệt; số legs riêng lẻ không đủ.
- **Nộp/đạt:** 3 chart, bảng cha/con; không nhập nhãn khác degree thành một chuỗi.

#### Day 04 — Ba quy tắc impulse / Standard impulse rule audit
- **Đọc:** [PDF 14–17](./data/Elliott-waves-made-simple-mast-steve-sinclair.pdf#page=14); đối chiếu lưu ý overlap ở trên.
- **Mục tiêu:** loại count sai bằng giá, không bằng cảm giác.
- **Nguyên lý:** wave 2/origin; wave 3/progress và not-shortest; wave 4/wave-1 territory; endpoint pass chưa chứng minh internals.
- **Ví dụ mới:** 2300, 2340, 2320, 2390, 2350, 2410; đổi điểm 4 thành 2335 để tạo lỗi overlap.
- **Bài tập:** tính độ dài 1/3/5; kiểm tra cả bản gốc và bản sửa; đảo sang mẫu giảm.
- **XAUUSD:** kiểm tra 3 candidate, ghi pass/fail/undecidable cho từng điều kiện.
- **Đáp án định hướng:** 40/70/60; bản gốc chưa thấy vi phạm ở endpoint, bản sửa thất bại overlap. Xem [unit mẫu có hình và 10 câu](./units/unit-04.md).
- **Nộp/đạt:** 3 audit; phải phát hiện mọi hard-rule violation trong bài mẫu.

#### Day 05 — Wave 2, wave 4 và invalidation / Corrections inside an impulse
- **Đọc:** [PDF 15–19](./data/Elliott-waves-made-simple-mast-steve-sinclair.pdf#page=15); alternation là phần bổ sung của khóa học.
- **Mục tiêu:** phân biệt quy tắc hủy với xu hướng hồi sâu/nông.
- **Nguyên lý:** corrective roles; alternation là guideline; giá và thời gian là hai chiều khác nhau; invalidation cố định theo giả thuyết.
- **Ví dụ mới:** wave 1 dài 40, wave 2 hồi 20; wave 3 dài 70, wave 4 hồi 40: 50% và 57,14%.
- **Bài tập:** wave 4 hồi sâu hơn wave 2 có tự vô hiệu không? Với endpoint day 04 thì overlap có xảy ra không?
- **XAUUSD:** 3 cặp wave 2/4; ghi shape, depth, duration, invalidation.
- **Đáp án định hướng:** không tự vô hiệu vì alternation; 2350 vẫn trên 2340. Không bỏ qua hard rules.
- **Nộp/đạt:** kiểm tra giai đoạn: 8/10 câu và không bỏ sót lỗi origin/overlap.

### Giai đoạn 2 — Mở rộng, diagonal và phương án thay thế / Days 6–10

#### Day 06 — Sóng mở rộng / Recognizing extensions
- **Đọc:** [PDF 18–21](./data/Elliott-waves-made-simple-mast-steve-sinclair.pdf#page=18), đặc biệt Gold ở trang 21.
- **Mục tiêu:** nhìn thấy một sóng chứa cấu trúc nhỏ hơn thay vì đổi degree giữa chừng.
- **Nguyên lý:** extension trong 1/3/5; subdivision; scale; giới hạn mẹo đếm chín legs.
- **Ví dụ mới:** parent wave 3 từ 2320 đến 2440, chứa 2320→2360→2340→2410→2380→2440.
- **Bài tập:** tính ba motive legs nội bộ; giải thích vì sao có thêm swing không tự tạo thêm parent wave.
- **XAUUSD:** 2 candidate extensions; một bản parent, một bản internals.
- **Đáp án định hướng:** 40/70/60; năm subwaves thuộc một parent wave 3, chưa chứng minh bằng số đỉnh đơn thuần.
- **Nộp/đạt:** hai sơ đồ degree nhất quán hoặc ghi rõ chưa đủ dữ liệu.

#### Day 07 — So sánh extension và impulse thường / Avoiding premature wave 5
- **Đọc:** [PDF 18–21](./data/Elliott-waves-made-simple-mast-steve-sinclair.pdf#page=18).
- **Mục tiêu:** không gọi mọi đỉnh thứ ba là kết thúc trend.
- **Nguyên lý:** candidate wave 3 còn tiếp diễn; 5 và 9 legs là mẹo quan sát; trend strength không định danh; kiểm tra lower degree.
- **Ví dụ mới:** chỉ lộ ba endpoint của subwave, sau đó mở thêm hai; giữ hai kịch bản trước reveal.
- **Bài tập:** lập “wave 3 đã xong” và “wave 3 đang mở rộng”, ghi điều kiện bác bỏ cho từng phương án.
- **XAUUSD:** 2 replay ở đoạn có momentum mạnh; lưu trước/sau 5 nến.
- **Đáp án định hướng:** chưa được chọn thắng bằng phần chart còn ẩn; cả hai phương án phải tuân cùng hard rules.
- **Nộp/đạt:** 2 bản dự đoán có timestamp; không sửa ảnh cũ.

#### Day 08 — Leading diagonal / Motive structure at a beginning
- **Đọc:** [PDF 21–24](./data/Elliott-waves-made-simple-mast-steve-sinclair.pdf#page=21).
- **Mục tiêu:** nhận biết candidate ở wave 1 hoặc A, không dùng diagonal như nhãn cứu hộ.
- **Nguyên lý:** vị trí; overlap; đường biên; internals và quy ước tài liệu.
- **Ví dụ mới:** 2300→2360→2320→2370→2340→2380 có overlap nhưng chưa chứng minh leading diagonal.
- **Bài tập:** liệt kê ba bằng chứng còn thiếu; nêu vì sao standard-impulse checker phải phản đối mẫu này.
- **XAUUSD:** 1 candidate và 1 false positive; không bắt buộc tìm được diagonal rõ ràng.
- **Đáp án định hướng:** cần parent position, subdivision và hình học/degree phù hợp; overlap đơn độc không đủ.
- **Nộp/đạt:** 2 hồ sơ nhận diện, không báo “đúng” chỉ vì wedge.

#### Day 09 — Ending diagonal / Exhaustion hypothesis, not a reversal signal
- **Đọc:** [PDF 24–27](./data/Elliott-waves-made-simple-mast-steve-sinclair.pdf#page=24).
- **Mục tiêu:** phân biệt cấu trúc cuối wave 5/C với cấu trúc đầu wave 1/A.
- **Nguyên lý:** terminal position; các chân điều chỉnh; overlap; wedge breakout không đảm bảo đảo chiều.
- **Ví dụ mới:** cùng hình học day 08 đặt ở cuối parent wave 5; so sánh tác động của ngữ cảnh.
- **Bài tập:** nếu không thấy internals thì kết luận nào được phép? Nếu giá phá đường biên nhưng không phá swing thì sao?
- **XAUUSD:** 2 wedge studies, ít nhất một hồ sơ giữ nhãn “unconfirmed”.
- **Đáp án định hướng:** chỉ là candidate; phá đường vẽ chủ quan chưa chứng minh cấu trúc hay một fill.
- **Nộp/đạt:** bảng leading/ending gồm vị trí, internals, invalidation và điều chưa biết.

#### Day 10 — Kiểm tra motive và alternate counts / Motive checkpoint
- **Đọc lại:** [PDF 13–27](./data/Elliott-waves-made-simple-mast-steve-sinclair.pdf#page=13).
- **Mục tiêu:** lựa chọn có lý do giữa impulse, extension, diagonal và no-count.
- **Nguyên lý:** primary không phải certainty; alternate phải thực sự khác; invalidation; không relabel theo kết quả.
- **Ví dụ mới:** một đường năm legs có thể nằm trong wave 1 hoặc A; nêu cách diễn biến sau phân biệt chúng.
- **Bài tập:** 10 case che nhãn: phân loại, ghi quy tắc, chỉ ra dữ liệu thiếu; 2 case phải được phép “không đủ bằng chứng”.
- **XAUUSD:** 3 cặp primary/alternate, đóng băng ở cùng cutoff.
- **Đáp án định hướng:** đánh giá chất lượng lý do và sự nhất quán, không chấm bằng việc giá sau đó đi đúng hướng.
- **Nộp/đạt:** ≥8/10, không dùng diagonal để che hard-rule failure.

### Giai đoạn 3 — Corrections / Days 11–17

#### Day 11 — Zigzag 5–3–5 / Distinguishing ABC from 1–2–3
- **Đọc:** [PDF 28–32](./data/Elliott-waves-made-simple-mast-steve-sinclair.pdf#page=28).
- **Mục tiêu:** kiểm chứng ABC theo internals thay vì chỉ nhìn ba đoạn.
- **Nguyên lý:** A motive; B corrective; C motive; A≈C chỉ là quan hệ tham khảo.
- **Ví dụ mới:** 2400→2340→2370→2310, A=C=60, B hồi 50%.
- **Bài tập:** nếu A không thấy năm subwaves thì giữ những khả năng nào? A=C có loại 1–2–3 không?
- **XAUUSD:** 3 ABC candidates, một chart H4 và một internal view mỗi ca.
- **Đáp án định hướng:** không chứng nhận zigzag; equality không loại motive interpretation nếu thiếu parent context.
- **Nộp/đạt:** 3 audit có mục “unknown internals”.

#### Day 12 — Regular flat 3–3–5 / Deep B retracement
- **Đọc:** [PDF 32–35](./data/Elliott-waves-made-simple-mast-steve-sinclair.pdf#page=32).
- **Mục tiêu:** phân biệt flat với zigzag bằng A/B internals và B retracement.
- **Nguyên lý:** 3–3–5; B hồi sâu; quy ước ≥90%; C không được suy từ dáng ngoài.
- **Ví dụ mới:** 2400→2350→2396→2345; B=46/50=92%.
- **Bài tập:** B ở 2390 thì tỷ lệ bao nhiêu và nhãn flat có đạt quy ước khóa học không?
- **XAUUSD:** 2 flat candidates và 1 ca B quá nông, ghi rõ bác bỏ hay chưa đủ dữ liệu.
- **Đáp án định hướng:** 80%, không đạt ngưỡng 90%; không áp ngoại lệ 78,6% chỉ vì symbol được giao dịch trên MT5.
- **Nộp/đạt:** tính đúng B%, không trộn 3–3–5 với 5–3–5.

#### Day 13 — Expanded và running flat / False breakouts and failed C
- **Đọc:** [PDF 35–39](./data/Elliott-waves-made-simple-mast-steve-sinclair.pdf#page=35).
- **Mục tiêu:** phân loại theo endpoint B/C và không lạm dụng running flat.
- **Nguyên lý:** B vượt gốc A; C vượt/không vượt A-end; internals; rarity không là bằng chứng.
- **Ví dụ mới:** A:2400→2350, B:2420; C=2330 hoặc 2360.
- **Bài tập:** đặt tên hai candidate và nêu điều kiện cần thêm để không chỉ là hai bản vẽ.
- **XAUUSD:** 2 expanded-flat studies; running-flat chỉ nhận diện nếu có đủ dữ liệu.
- **Đáp án định hướng:** C2330 expanded candidate, C2360 running candidate; cả hai cần 3–3–5 và parent context.
- **Nộp/đạt:** 2 so sánh; không ép tìm running flat.

#### Day 14 — Contracting và barrier triangle / Five corrective legs
- **Đọc:** [PDF 39–42, 45](./data/Elliott-waves-made-simple-mast-steve-sinclair.pdf#page=39).
- **Mục tiêu:** vẽ A–B–C–D–E và phân biệt triangle với range tùy ý.
- **Nguyên lý:** năm legs điều chỉnh; boundary lines; B/D gần ngang ở barrier; vị trí wave 4/B/X.
- **Ví dụ mới:** 2400→2340→2385→2350→2380→2360.
- **Bài tập:** tính biên độ từng chân; cần thay B/D thế nào để minh họa barrier? Vì sao không gọi đây là toàn bộ wave 2?
- **XAUUSD:** 2 consolidation studies, cho phép kết luận range chưa đủ Elliott evidence.
- **Đáp án định hướng:** độ dài 60/45/35/30/20; hình thu hẹp chưa chứng minh internals hay vị trí.
- **Nộp/đạt:** phân biệt triangle candidate với “năm pivot bất kỳ”.

#### Day 15 — Running và expanding triangle / Variant comparison
- **Đọc:** [PDF 42–46](./data/Elliott-waves-made-simple-mast-steve-sinclair.pdf#page=42), xem Gold H4 trang 46.
- **Mục tiêu:** không nhầm running triangle với running flat.
- **Nguyên lý:** B vượt gốc A trong running form; biên mở rộng; năm corrective legs; breakout không đảm bảo follow-through.
- **Ví dụ mới:** running:2400→2340→2410→2355→2400→2370; expanding:2400→2380→2410→2370→2420→2360.
- **Bài tập:** tính độ dài năm chân của cả hai; gắn nhãn endpoint và chỉ ra điểm khác với ABC flat.
- **XAUUSD:** 2 range variants hoặc 1 ca và ghi thiếu mẫu.
- **Đáp án định hướng:** running B vượt 2400; expanding legs 20/30/40/50/60; không dùng hình để đảm bảo sóng tiếp.
- **Nộp/đạt:** 2 sơ đồ, ghi chính xác tên và degree.

#### Day 16 — Double / triple three / W–X–Y and W–X–Y–X–Z
- **Đọc:** [PDF 46–56](./data/Elliott-waves-made-simple-mast-steve-sinclair.pdf#page=46).
- **Mục tiêu:** hiểu các khối correction nối nhau, không đếm máy móc bảy swing.
- **Nguyên lý:** W/Y/Z là cấu trúc điều chỉnh; X nối; degree consistency; heuristic không phải chứng minh.
- **Ví dụ mới:** W là zigzag, X hồi, Y là flat candidate; vẽ khối trước rồi mới mở internals.
- **Bài tập:** cùng bảy swing, viết hai cách diễn giải và bằng chứng còn thiếu; phân biệt double zigzag với sideways combination.
- **XAUUSD:** 2 vùng choppy kéo dài, một ca được phép để “complex, unresolved”.
- **Đáp án định hướng:** nhãn WXY không thay thế kiểm tra constituent patterns; không buộc mọi chân là zigzag ba swing đơn giản.
- **Nộp/đạt:** 2 block maps; không chấm tự động bằng impulse checker.

#### Day 17 — Kiểm tra correction / Correction decision tree
- **Đọc lại:** [PDF 28–56](./data/Elliott-waves-made-simple-mast-steve-sinclair.pdf#page=28).
- **Mục tiêu:** chọn pattern dựa trên evidence và biết dừng ở no-count.
- **Nguyên lý:** A structure; B depth; C structure; vị trí và degree; ambiguous cases.
- **Ví dụ mới:** ba endpoint ABC như nhau nhưng A-internals khác nhau; kết luận khác mức tin cậy.
- **Bài tập:** 10 case gồm 3 zigzag, 3 flat, 2 triangle và 2 không đủ dữ liệu, không mở nhãn nguồn.
- **XAUUSD:** 3 correction packets với một alternative mỗi ca.
- **Đáp án định hướng:** sơ đồ quyết định phải có nhánh “chưa biết”; không chọn pattern chỉ vì giống ảnh.
- **Nộp/đạt:** ≥8/10, tính đúng B retracement và không gán triangle độc lập vào wave 2.

### Giai đoạn 4 — Đo lường và xác nhận phụ / Days 18–22

#### Day 18 — Fibonacci retracement / Correct anchoring
- **Đọc:** [PDF 57–60](./data/Elliott-waves-made-simple-mast-steve-sinclair.pdf#page=57).
- **Mục tiêu:** đo correction bằng hai anchor, không đảo hướng công thức.
- **Nguyên lý:** absolute distance; directional formula; 50% không phải tỷ lệ Fibonacci thuần; tỷ lệ không định danh sóng.
- **Ví dụ mới:** wave tăng 2300→2400: 38,2%=2361,8; 50%=2350; 61,8%=2338,2.
- **Bài tập:** tính ba mức cho wave giảm 2400→2300; đo correction thực tế về 2360.
- **XAUUSD:** 5 retracement worksheets; chụp hai anchor và giá mức đo.
- **Đáp án định hướng:** mẫu giảm:2338,2/2350/2361,8; về 2360 là hồi 40% của wave tăng.
- **Nộp/đạt:** 5 phép đo đúng hướng, không đổi anchors để khớp tỷ lệ đẹp.

#### Day 19 — Projection cho wave 3 và C / Three-anchor measurement
- **Đọc:** [PDF 59–61, 79, 82–83](./data/Elliott-waves-made-simple-mast-steve-sinclair.pdf#page=59).
- **Mục tiêu:** tách đo độ dài khỏi điểm đặt projection.
- **Nguyên lý:** vector có dấu; 3 anchors; endpoint chỉ biết sau xác nhận; target không đảm bảo.
- **Ví dụ mới:** 2300→2400, pullback2350: 100%=2450; 161,8%=2511,8.
- **Bài tập:** projection giảm 2400→2300 từ2350; giải thích lỗi chiếu từ2400 trong mẫu tăng.
- **XAUUSD:** 3 wave-3 và 2 C projection candidates, không gọi là fill/target hit trade.
- **Đáp án định hướng:** 2250/2188,2; phải dùng điểm kết thúc pullback theo giả thuyết, không âm thầm đổi reference.
- **Nộp/đạt:** 5 bảng có công thức, timestamps và anchors.

#### Day 20 — Wave 5, confluence và sai số / Relationships, not certainty
- **Đọc:** [PDF 60–61, 80–81](./data/Elliott-waves-made-simple-mast-steve-sinclair.pdf#page=60).
- **Mục tiêu:** xây vùng tham khảo và phân biệt cách định nghĩa “inverse”.
- **Nguyên lý:** wave-1 equality; wave-4-based projection; confluence có thể trùng thông tin; tolerance định trước.
- **Ví dụ mới:** wave1=40, điểm4=2350 → equality2390; wave4 giảm2390→2350 dài40 → projection 1,618 từ2350 là2414,72.
- **Bài tập:** viết công thức trước khi dùng tool; nếu hai mức cách24,72 thì với tolerance5 có phải một vùng không?
- **XAUUSD:** 3 zones với tolerance cố định; lưu ít nhất một trường hợp không có confluence.
- **Đáp án định hướng:** không; thuật ngữ “inverse” trong nguồn phải được thay bằng công thức và anchor rõ ràng.
- **Nộp/đạt:** 3 worksheets không cherry-pick mức/độ rộng sau khi thấy giá.

#### Day 21 — Chart patterns và Elliott / Context before resemblance
- **Đọc:** [PDF 62–71](./data/Elliott-waves-made-simple-mast-steve-sinclair.pdf#page=62).
- **Mục tiêu:** dùng high/low, double top, H&S, wedge, triangle làm gợi ý tìm kiếm, không làm bộ dịch nhãn tự động.
- **Nguyên lý:** turning point; nhiều wave maps cho một shape; parent context; false positive.
- **Ví dụ mới:** hai đỉnh2400/2398 có thể là B-retest, wave5 candidate hoặc range; chưa đủ flat.
- **Bài tập:** lập hai wave maps cho một double top; nêu điều kiện khiến mỗi map thất bại.
- **XAUUSD:** 4 shapes trên H4, kiểm tra H1 internals tại cùng cutoff.
- **Đáp án định hướng:** dáng hai đỉnh không chứng minh 3–3–5; cần cấu trúc trước và trong pattern.
- **Nộp/đạt:** 4 evidence tables có ít nhất một false-positive rejection.

#### Day 22 — RSI divergence / Supporting evidence only
- **Đọc:** [PDF 71–76](./data/Elliott-waves-made-simple-mast-steve-sinclair.pdf#page=71), Gold trang73.
- **Mục tiêu:** so sánh momentum ở pivot tương ứng, không lấy divergence làm lệnh.
- **Nguyên lý:** price vs oscillator; timestamp alignment; xác định settings; divergence có thể kéo dài.
- **Ví dụ mới:** giá2380→2400 trong khi RSI72→64: bearish divergence candidate, không tự là wave5.
- **Bài tập:** giá tạo lower low, RSI higher low gọi gì? Thiếu divergence có hủy impulse không?
- **XAUUSD:** 3 so sánh bằng RSI(14), Wilder, close trong MT5; ghi settings, warm-up và timestamps. Lab hiện có chưa hiển thị RSI.
- **Đáp án định hướng:** bullish divergence; không hủy count chỉ vì RSI. Không dựng RSI từ ảnh hoặc ước lượng bằng mắt.
- **Nộp/đạt:** 3 price/RSI pairs, một ca không divergence và không suy diễn reversal.

### Giai đoạn 5 — Kế hoạch giả định và rủi ro / Days 23–27

#### Day 23 — Kế hoạch wave 3 / Prepare during wave 2
- **Đọc:** [PDF 78–80, 84–86](./data/Elliott-waves-made-simple-mast-steve-sinclair.pdf#page=78).
- **Mục tiêu:** chuyển count thành điều kiện kiểm thử, không mua vì chạm Fib.
- **Nguyên lý:** parent alignment; wave1 internals; trigger vs retracement zone; invalidation vs stop; không biết đáy2 trước.
- **Ví dụ mới:** 2300→2400, vùng2350; chỉ sau khi giả định điểm2 được xác định mới tính projection2450/2511,8.
- **Bài tập:** viết hai quy trình: limit giả định và confirmation; điều kiện hủy trước khớp và quy tắc không chase.
- **XAUUSD:** 3 pre-reveal plans, cho phép kết quả no-trade.
- **Đáp án định hướng:** điểm2 không được lấy từ tương lai; “vùng hồi” không chứng minh hoàn thành correction.
- **Nộp/đạt:** 3 plans có timestamp, trigger, invalidation, stop, expiry và thông tin còn thiếu.

#### Day 24 — Quản trị rủi ro trước mô phỏng / Risk before execution claims
- **Đọc:** [PDF 78, 84](./data/Elliott-waves-made-simple-mast-steve-sinclair.pdf#page=78), phản biện mức rủi ro nguồn.
- **Mục tiêu:** tính tổng rủi ro và dừng khi thiếu broker specifications.
- **Nguyên lý:** cash budget; risk/lot; volume step làm tròn xuống; tổng rủi ro nhiều lệnh; modeled costs.
- **Ví dụ mới, hoàn toàn giả định:** equity10000, budget0,5%=50; distance5, contract10 oz/lot, conversion1, costs2/lot → risk52/lot; step0,01 → 0,96 lot, risk49,92.
- **Bài tập:** nếu hai lệnh cùng có thể khớp thì chia budget thế nào? Nếu không biết contract thì có được dùng10 không?
- **XAUUSD:** 3 specification worksheets; ghi “unavailable” thay vì bịa giá trị.
- **Đáp án định hướng:** tổng modeled risk ≤50, không 50 mỗi lệnh; thông số giả định không phải đặc tả XAUUSDm.
- **Nộp/đạt:** tính đúng 3 ca, không tự suy contract từ tên symbol.

#### Day 25 — Kế hoạch wave 5 / Prepare during wave 4
- **Đọc:** [PDF 80–81, 86–88](./data/Elliott-waves-made-simple-mast-steve-sinclair.pdf#page=80), ví dụ trang96–98.
- **Mục tiêu:** đánh giá mục tiêu còn lại và rủi ro truncation/extension.
- **Nguyên lý:** wave3 maturity chưa chắc; wave4 overlap; stop theo trade rule khác structural invalidation; R không đủ thì bỏ.
- **Ví dụ mới:** entry2350, stop2338, target2370 → gross R=20/12=1,67 trước chi phí.
- **Bài tập:** nếu quy tắc mô phỏng yêu cầu gross R≥2 thì có được kéo target lên sau khi thấy chart không?
- **XAUUSD:** 3 wave5 plans; bắt buộc một no-trade hoặc ghi không có case đủ dữ liệu.
- **Đáp án định hướng:** bỏ theo quy tắc đã khóa; không thay mục tiêu chỉ để đạt tỷ lệ.
- **Nộp/đạt:** 3 sheets có lập luận wave3/4 và rejection condition.

#### Day 26 — Kế hoạch wave C / Prepare during B
- **Đọc:** [PDF 82–83, 88–89](./data/Elliott-waves-made-simple-mast-steve-sinclair.pdf#page=82), ví dụ trang91–92.
- **Mục tiêu:** chỉ xây C plan khi hiểu dạng correction và parent context.
- **Nguyên lý:** A motive trong zigzag; B chưa chắc xong; signed projection; stop/source conventions; countertrend risk.
- **Ví dụ mới:** A2400→2340, B2370; equality C=2310. Entry2365, stop2402 cho gross R55/37≈1,49.
- **Bài tập:** equality đẹp có làm R tốt hơn không? Nếu A là ba sóng thì giả thuyết nào phải xem lại?
- **XAUUSD:** 3 C plans, ghi trước reveal cả khả năng correction tiếp tục.
- **Đáp án định hướng:** không; cần xét flat/complex/unknown thay vì mặc định zigzag.
- **Nộp/đạt:** 3 plans, không đồng nhất mọi A–B–C với 5–3–5.

#### Day 27 — Limit và confirmation / Compare entry policies fairly
- **Đọc:** [PDF 77–90](./data/Elliott-waves-made-simple-mast-steve-sinclair.pdf#page=77).
- **Mục tiêu:** so sánh phương pháp, không đồng nhất “aggressive” với tăng phần trăm rủi ro.
- **Nguyên lý:** cùng cash budget; cùng tập case; missed trades; expiration; break-even vẫn có chi phí.
- **Ví dụ mới:** policy A có2 legs, mỗi leg budget25; policy B một leg budget50; cả hai tổng50.
- **Bài tập:** lập bảng filled/unfilled/invalidated/ambiguous cho cùng3 setups; chọn trước quy tắc BE hoặc không BE.
- **XAUUSD:** 3 paired historical scenarios. Không có tick/bid/ask thì chỉ đánh giá điều kiện, không xác nhận fill.
- **Đáp án định hướng:** không bỏ unfilled và losers khỏi mẫu; hai pending orders không được nhân đôi budget.
- **Nộp/đạt:** 6 policy records có no-trade và ambiguity handling.

### Giai đoạn 6 — Replay, tự sửa và đánh giá / Days 28–30

#### Day 28 — Đọc lại ví dụ sách không nhìn tương lai / Source-case audit
- **Đọc:** [PDF 91–104](./data/Elliott-waves-made-simple-mast-steve-sinclair.pdf#page=91), chọn3 ví dụ thuộc wave3/5/C.
- **Mục tiêu:** tách narrative hậu nghiệm khỏi thông tin có thể biết khi ra quyết định.
- **Nguyên lý:** entry-time evidence; hindsight; selected examples; thiếu thông tin execution.
- **Ví dụ mới:** che phần chart sau vùng vào lệnh bằng giấy/cửa sổ đọc, tự viết kế hoạch rồi mới mở phần kết quả.
- **Bài tập:** cho từng ví dụ gốc, ghi trang/hình, điều thấy được, điều tác giả giả định, điều ảnh không chứng minh.
- **XAUUSD:** lặp cùng quy trình trên3 đoạn vàng của bạn; không gọi đây là tái tạo giao dịch trong sách.
- **Đáp án định hướng:** chart đã đi tới target không chứng minh fill, spread hay expectancy; không chỉ lấy winner.
- **Nộp/đạt:** 3 source audits +3 XAUUSD replay records tách rõ nguồn.

#### Day 29 — Kiểm thử và sổ lỗi / Frozen rules and error journal
- **Đọc:** [PDF 91–105](./data/Elliott-waves-made-simple-mast-steve-sinclair.pdf#page=91), dùng làm đối chiếu cách giải thích, không làm bằng chứng thống kê.
- **Mục tiêu:** kiểm tra quy trình trên tập liên tiếp chưa chọn theo kết quả.
- **Nguyên lý:** train/test separation; fixed rules; costs/ambiguity; phân biệt lỗi phân tích và outcome ngẫu nhiên.
- **Ví dụ mới:** 10 case liên tiếp của một setup đã khóa; lưu cả không đủ bằng chứng và không có lệnh.
- **Bài tập:** phân loại lỗi origin, overlap, degree, hindsight, execution assumptions; viết3 quy tắc phòng lỗi.
- **XAUUSD:** 10 sequential screens ở giai đoạn mới; 10 ca chỉ là pilot, không kết luận có edge.
- **Đáp án định hướng:** nếu thiếu execution data thì chỉ báo tỷ lệ tuân thủ cấu trúc, không tạo bảng lợi nhuận giả. Có net R hợp lệ mới tính mean R và vẫn nêu cỡ mẫu nhỏ.
- **Nộp/đạt:** ledger10 ca có tiêu chí lựa chọn, 3 lỗi gốc và biện pháp kiểm tra.

#### Day 30 — Bài thi và kế hoạch tiếp tục / Independent capstone
- **Đọc lại:** [PDF 105](./data/Elliott-waves-made-simple-mast-steve-sinclair.pdf#page=105) và các trang gắn với lỗi còn mắc.
- **Mục tiêu:** tự hoàn thành phân tích có thể bị bác bỏ, không cần một “đáp án sóng duy nhất”.
- **Nguyên lý:** evidence hierarchy; alternatives; uncertainty; risk discipline; continuous review.
- **Ví dụ mới:** một đoạn XAUUSD chưa dùng trong bài trước, cutoff được chọn trước khi xem phần tương lai.
- **Bài tập:** 20 câu lý thuyết/tính toán +1 Daily/H4/H1 study +1 kế hoạch giả định hoặc no-trade có lý do.
- **XAUUSD:** nộp trước/sau reveal, original/corrected count, bảng endpoints, invalidation và rule audit.
- **Đáp án định hướng:** chấm bằng chất lượng reasoning và kiểm soát thông tin; count đi sai hướng vẫn có thể được điểm quy trình.
- **Nộp/đạt:** ≥80/100 và không có critical error; chưa đạt thì học lại nhóm yếu, không chuyển sang tiền thật vì hết30 ngày.

## 7. Chấm bài và vòng sửa / Feedback protocol

### Bài thường: 20 điểm

| Tiêu chí | Điểm |
|---|---:|
| Nguồn, timeframe, cutoff và degree nhất quán | 4 |
| Endpoint theo wick và kiểm tra hard rules | 6 |
| Primary/alternate hoặc no-count có lý do | 4 |
| Tính toán và phân biệt giả định/thực tế | 3 |
| Giữ bản gốc, sửa có giải thích | 3 |

Đạt ≥16/20, đồng thời trả lời đúng ≥8/10 câu kiểm tra. Trong HTML, checkpoint trắc nghiệm là ≥5/6; 4 nhiệm vụ tự luận/vẽ cần đối chiếu rubric/nhận xét, không cộng điểm tự động. **Critical errors:** bỏ qua hard-rule violation, dùng nến tương lai như đã biết, bịa broker specs/fills, hoặc thay invalidation để giữ dự đoán. Phải sửa critical errors trước khi qua bài, dù đủ điểm.

### Mẫu nhận xét khi bạn gửi bài

1. **Observation:** chỉ ra đúng timestamp/price, không phán đoán chung chung.
2. **Rule:** phân biệt vi phạm cứng với guideline hoặc thiếu bằng chứng.
3. **Correction:** đề nghị cách sửa nhỏ nhất, hoặc bỏ nhãn nếu không thể cứu cấu trúc.
4. **Alternative:** trình bày một phương án còn khả dĩ, không khẳng định duy nhất đúng.
5. **Retry:** giao một thay đổi cụ thể; bạn tự vẽ lại, không chỉ sao chép đáp án.

### Bài thi cuối: 100 điểm

Lý thuyết/tính toán40; cấu trúc đa khung25; kiểm tra quy tắc và alternatives15; risk/no-trade10; review và bảo toàn bản gốc10. Không dùng P&L để thay điểm kỹ năng. Chỉ cấp kết luận “đạt mục tiêu học tập”, không chứng nhận chuyên nghiệp.

## 8. Sau ngày 30

Tiếp tục ít nhất một chu kỳ luyện tập mới trên các đoạn chưa dùng: tập trung nhóm lỗi còn lặp lại, tăng số case theo kế hoạch trước, kiểm tra ngoài mẫu và mô phỏng khi đủ dữ liệu. Không tăng đòn bẩy, quy mô hoặc tần suất chỉ vì count có vẻ đẹp hơn.
