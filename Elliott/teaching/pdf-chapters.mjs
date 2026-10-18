export const pdfSource = "data/Elliott-waves-made-simple-mast-steve-sinclair.pdf";
const section = (title, pages, summary, figures = []) => ({ title, pages, summary, figures });
const question = (pages, prompt, options, correct, explanation, figure) => ({
  pages, prompt, options, correct, explanation, ...(figure ? { figure } : {})
});

export const introduction = {
  title: "Introduction", pages: [7, 8],
  summary: "Đọc mục đích của sách: dùng Elliott Wave để phân biệt chuyển động theo xu hướng và điều chỉnh. Đây là phần giới thiệu phương pháp, chưa phải danh sách quy tắc hay kết quả kiểm chứng."
};
export const conclusion = {
  title: "Conclusion", pages: [105, 105],
  summary: "Tác giả kết thúc bằng việc nhấn mạnh luyện tập đều đặn và cải thiện cách đọc biến động thị trường. Ôn lại sáu chương theo thứ tự, thay vì học thêm chủ đề ngoài tài liệu."
};

export const chapters = [
  {
    id: 1, roman: "I", title: "ELLIOTT WAVE AT FIRST GLANCE",
    vi: "Tổng quan Elliott Wave", pages: [9, 12],
    sections: [
      section("Elliott Wave at First Glance", [9, 10], "Bắt đầu bằng cách nhìn toàn chu kỳ. Hình 1 dùng số cho pha motive và chữ cho pha corrective; chưa cần phân loại các biến thể sẽ học ở hai chương tiếp theo.", ["cycle"]),
      section("Motive Phase & Corrective Phase", [11, 11], "Motive đi cùng hướng xu hướng lớn và được minh họa bằng 1–2–3–4–5. Corrective là pha điều chỉnh, minh họa bằng A–B–C. Hướng của một chân riêng lẻ không đồng nghĩa hướng của cả chu kỳ."),
      section("Patterns on a Larger Scale", [11, 12], "Các hình 2–3 trình bày cấu trúc nhỏ ghép vào cấu trúc lớn. Khi đọc, theo một bộ nhãn ở một cấp trước, rồi mới nhìn các sóng con.")
    ],
    notes: [],
    questions: [
      question([11,11], "Theo chương I, một chu kỳ được trình bày gồm hai pha nào?", ["Motive và Corrective", "Entry và Exit", "Accumulation và Distribution"], 0, "Trang 11 giới thiệu hai pha, rồi dùng Hình 1 để phân biệt chúng."),
      question([11,11], "Pha motive chuyển động theo hướng nào?", ["Luôn tăng", "Cùng hướng xu hướng lớn", "Luôn ngược xu hướng lớn"], 1, "Motive được định nghĩa theo quan hệ với xu hướng lớn, không phải luôn có hướng tăng."),
      question([11,11], "Bộ nhãn nào dành cho motive trong Hình 1?", ["A–B–C", "W–X–Y", "1–2–3–4–5"], 2, "Hình 1 và phần giải thích trang 11 dùng năm số cho pha motive.", "cycle"),
      question([11,11], "Bộ nhãn minh họa corrective trong Hình 1 là gì?", ["A–B–C", "1–2–3–4–5", "W–X–Y–X–Z"], 0, "Ở mức giới thiệu của chương I, corrective được minh họa bằng ba nhãn A–B–C.", "cycle"),
      question([11,12], "Mục đích của Hình 2–3 là gì?", ["Quy định một timeframe duy nhất", "Minh họa cấu trúc sóng lặp ở quy mô lớn hơn", "Tính khối lượng giao dịch"], 1, "Trang 11–12 chuyển từ mô hình đơn giản sang mô hình chứa nhiều sóng nhỏ hơn."),
      question([11,12], "Khi mở rộng quy mô ở Hình 3, tác giả vẫn dùng các bộ nhãn cơ bản nào?", ["Chỉ RSI 30/70", "Chỉ High/Low", "1–5 và A–C"], 2, "Trang 12 nhắc rằng dù hình có nhiều sóng hơn, các bộ số và chữ cơ bản vẫn được giữ.")
    ]
  },
  {
    id: 2, roman: "II", title: "THE MOTIVE PHASE",
    vi: "Pha motive", pages: [13, 27],
    sections: [
      section("Impulsive", [14,17], "Theo dõi năm chân cấp lớn: 1/3/5 theo hướng chính, 2/4 điều chỉnh. Đọc quy tắc gốc wave 1, so chiều dài 1/3/5 và điều kiện overlap. Hình 5 đặt cấu trúc đơn cạnh cấu trúc có sóng con.", ["internals"]),
      section("Extended", [18,21], "Một chân motive được chia nhỏ rõ hơn tạo dạng extension mà sách minh họa bằng chín nhịp. Case Gold ở Hình 10 chọn wave 1 mở rộng; wave 3 vẫn không ngắn nhất trong ba chân motive.", ["extension"]),
      section("Diagonals — Leading Diagonals (5-3-5-3-5)", [21,24], "Theo quy ước của sách, leading diagonal nằm ở wave 1 hoặc A của zigzag. So vị trí và cấu trúc con với impulse; Hình 12 minh họa chuyển động giảm có overlap.", ["leading"]),
      section("Diagonals — Ending Diagonal (3-3-3-3-3)", [24,27], "Ending diagonal nằm ở giai đoạn kết thúc, tại wave 5 hoặc C. Quan sát các chân (i)–(v) và wedge trong Hình 14, thay vì chỉ nhìn nhịp giảm sau đó.", ["ending"])
    ],
    notes: [
      { pages: [15,16], text: "Sách dùng cụm “Wave 2 territory” khi mô tả overlap. Phần giảng ghi nhận nguyên văn thuật ngữ nguồn; không ra câu hỏi bắt học viên coi cách diễn đạt này là quy tắc chuẩn không tranh luận." },
      { pages: [18,19], text: "Phát biểu chỉ một wave được extension là cách trình bày của tác giả; không biến thành khẳng định phổ quát." }
    ],
    questions: [
      question([13,14], "Bốn dạng motive được chương II giới thiệu là gì?", ["Zigzag, flat, triangle, double three", "Impulsive, extended, leading diagonal, ending diagonal", "Head & Shoulders, double top, RSI, Fibonacci"], 1, "Trang 14 liệt kê bốn dạng, sau đó chia mục Impulsive, Extended và Diagonals."),
      question([15,15], "Trong impulse, các chân nào đi theo hướng xu hướng lớn?", ["2 và 4", "A và B", "1, 3 và 5"], 2, "Trang 15 phân biệt 1/3/5 là các chân trending, còn 2/4 là pullback."),
      question([14,15], "Cấu trúc con của impulse được sách ghi là gì?", ["5–3–5–3–5", "3–3–5", "3–3–3–3–3"], 0, "Tiêu đề Impulsive Waves và Hình 5 trình bày cấu trúc 5–3–5–3–5.", "internals"),
      question([15,16], "Quy tắc wave 2 liên quan đến mốc nào?", ["Đỉnh RSI", "Điểm bắt đầu wave 1", "Target wave 5"], 1, "Wave 2 không được đi vượt điểm bắt đầu wave 1; chiều bất đẳng thức đổi theo hướng thị trường."),
      question([15,16], "Phát biểu nào đúng với quy tắc chiều dài wave 3 được sách nêu?", ["3 bắt buộc luôn dài nhất", "3 bắt buộc bằng 1", "3 không được ngắn nhất trong 1, 3 và 5"], 2, "Sách cho phép 3 ngắn hơn 1 hoặc 5, nhưng không ngắn hơn cả hai."),
      question([18,19], "Dạng extended trong cách minh họa của sách có bao nhiêu nhịp thay vì năm?", ["Chín", "Ba", "Mười hai"], 0, "Trang 18 mô tả một chân mở rộng thành năm sóng con, tạo hình nhìn thấy chín nhịp."),
      question([21,21], "Hình 10 Gold Daily chọn chân nào làm extended wave?", ["Wave 5", "Wave 1", "Wave 2"], 1, "Phần giải thích ngay dưới Hình 10 chọn wave 1 là chân mở rộng.", "extension"),
      question([21,23], "Theo chương II, leading diagonal xuất hiện ở đâu?", ["Chỉ wave 4", "Chỉ wave B", "Wave 1 hoặc A của zigzag"], 2, "Trang 22 giới hạn vị trí leading diagonal theo cách trình bày của sách."),
      question([24,25], "Ending diagonal được sách đặt ở vị trí nào?", ["Wave 5 hoặc C", "Wave 2 hoặc X", "Chỉ wave 1"], 0, "Trang 24 giới thiệu ending diagonal ở giai đoạn kết thúc motive, trong 5 hoặc C."),
      question([24,27], "Cấu trúc con nào được ghi trong tiêu đề Ending Diagonal?", ["5–3–5–3–5", "3–3–3–3–3", "5–5–5"], 1, "Sách ghi Ending Diagonal (3-3-3-3-3), khác leading diagonal của chương.", "ending")
    ]
  },
  {
    id: 3, roman: "III", title: "THE CORRECTIVE PHASE",
    vi: "Pha điều chỉnh", pages: [28,56],
    sections: [
      section("1. Simple Correction — Zig-Zag Correction (5-3-5)", [28,32], "Zigzag dùng A–B–C: A/C motive, B corrective. Với điều chỉnh trong uptrend, sách yêu cầu B dưới gốc A và C xuống dưới cuối A; đảo hướng cho điều chỉnh trong downtrend.", ["zigzag"]),
      section("Flat Correction (3-3-5)", [32,33], "A/B có tính điều chỉnh, C có năm sóng. Sách đặt ngưỡng B kiểm tra lại A và có ngoại lệ riêng cho forex; đọc rõ phạm vi trước khi so ba biến thể."),
      section("Regular Flat Correction", [33,35], "B hồi sâu nhưng không vượt gốc A; C vượt cuối A theo hướng điều chỉnh. Dùng Hình 20 để theo A/B/C cấp lớn trước khi đọc nhãn con.", ["regular-flat"]),
      section("Expanding Flat Correction", [35,37], "B vượt gốc A; C tiếp tục vượt cuối A. Sách dùng tên Expanding Flat, nên khóa này giữ tên đó thay vì tự đổi hệ thuật ngữ.", ["expanded-flat"]),
      section("Running Flat Correction", [37,39], "B cũng vượt gốc A, nhưng C không vượt cuối A. Đây là khác biệt cần so trực tiếp với Expanding Flat; sách coi running flat hiếm.", ["running-flat"]),
      section("Triangle Correction (3-3-3-3-3)", [39,46], "Năm chân A–B–C–D–E. Học đúng thứ tự Contracting → Barrier → Running → Expanding; so co/mở rộng, B/D gần ngang và B vượt gốc A.", ["contracting", "running-triangle"]),
      section("2. Complex Correction — Double Three (3-3-3)", [46,51], "Sách dùng W–X–Y cho ba thành phần điều chỉnh. X nối W và Y. Đọc các dạng được phép ở từng thành phần và quy tắc tác giả ghi ở trang 50."),
      section("Triple Three (3-3-3-3-3)", [51,54], "Dạng nối dài dùng W–X–Y–X–Z; phần liệt kê còn ký hiệu connector thứ hai là X2. Hình 36 giúp phân biệt các nhãn thành phần với A/B/C bên trong.", ["combination"]),
      section("A Simple Trick In Identifying Complex Corrections!", [54,56], "Tác giả đếm bảy higher highs/higher lows để nhận diện double three, rồi đặt W ở nhịp 3, X ở nhịp 4 và Y ở nhịp 7. Đây là mẹo nhận diện trong sách, không phải một bài kiểm chứng độc lập.")
    ],
    notes: [
      { pages: [33,34], text: "Câu hỏi đọc hiểu giữ cả ngưỡng 90% và ngoại lệ 78,6% trong forex như sách nêu; không âm thầm thay bằng ngưỡng riêng của khóa cũ." },
      { pages: [50,55], text: "Sách phân biệt các quy tắc complex do tác giả dùng và mẹo bảy nhịp. Học để hiểu nguồn, không suy ra bảy swing bất kỳ tự chứng minh W–X–Y." }
    ],
    questions: [
      question([29,30], "Cấu trúc con của zigzag là gì?", ["3–3–5", "5–3–5", "3–3–3–3–3"], 1, "A và C có năm sóng, B có ba sóng trong cách trình bày zigzag."),
      question([29,30], "Trong zigzag, chân nào có tính corrective?", ["A", "C", "B"], 2, "Trang 29 phân loại A/C motive và B corrective."),
      question([30,30], "Zigzag điều chỉnh trong uptrend: endpoint B phải ở đâu?", ["Dưới gốc A", "Trên gốc A", "Bất kỳ vị trí nào"], 0, "Quy tắc đầu tiên ở trang 30 yêu cầu B kết thúc dưới nơi A bắt đầu."),
      question([30,30], "Zigzag điều chỉnh trong uptrend: endpoint C phải ở đâu?", ["Trên gốc A", "Dưới cuối A", "Bằng cuối B"], 1, "Quy tắc thứ hai yêu cầu C phá xuống dưới cuối A.", "zigzag"),
      question([32,34], "Cấu trúc chung của flat là gì?", ["5–3–5", "5–5–5", "3–3–5"], 2, "Trong flat, A/B corrective và C motive."),
      question([33,34], "Sách nêu ngưỡng B của flat và ngoại lệ forex như thế nào?", ["90%; cho phép 78,6% trong forex", "50%; luôn cho phép 23,6%", "161,8%; không có ngoại lệ"], 0, "Trang 33–34 ghi 90%, với ngoại lệ tối thiểu 78,6% cho forex; câu này kiểm tra chính nội dung nguồn."),
      question([34,34], "Regular flat: B có vượt gốc A không?", ["Bắt buộc vượt", "Không vượt gốc A", "Không cần quan sát B"], 1, "Mô tả regular flat nói B hồi sâu nhưng không vượt điểm bắt đầu A.", "regular-flat"),
      question([36,36], "Expanding flat điều chỉnh trong uptrend: điều kiện cặp B/C nào được sách nêu?", ["B dưới gốc A; C trên cuối A", "B chỉ bằng 50% A; C không quan trọng", "B vượt gốc A; C xuống dưới cuối A"], 2, "Trang 36 mô tả B overshoot và C vượt cuối A theo hướng điều chỉnh.", "expanded-flat"),
      question([38,39], "Điểm nào phân biệt running flat với expanding flat?", ["C không vượt cuối A", "Không có wave B", "C chỉ có ba sóng"], 0, "Running giữ 3–3–5 nhưng C không vượt endpoint A.", "running-flat"),
      question([40,40], "Triangle được gắn nhãn như thế nào?", ["1–2–3", "A–B–C–D–E", "W–X–Y"], 1, "Trang 40 dùng năm chữ cho năm chân triangle."),
      question([40,44], "Bộ bốn biến thể triangle theo thứ tự sách là gì?", ["Regular, expanding, running, triple", "Leading, ending, extended, flat", "Contracting, barrier, running, expanding"], 2, "Các mục trang 40–44 lần lượt trình bày bốn biến thể này."),
      question([41,42], "Barrier triangle có đặc điểm bổ sung nào?", ["B và D kết thúc gần cùng mức", "Không có chân E", "Mọi chân đều dài hơn chân trước"], 0, "B–D gần ngang là đặc điểm sách bổ sung so với contracting."),
      question([42,46], "Running triangle điều chỉnh trong uptrend có B như thế nào?", ["Dừng đúng giữa A", "Vượt mức bắt đầu A", "Luôn thấp hơn cuối A"], 1, "Trang 43 ghi B vượt gốc A; Gold ở Hình 32 minh họa đặc điểm này.", "running-triangle"),
      question([43,44], "Expanding triangle: quan hệ độ dài các chân là gì?", ["B<A, C<B, D<C, E<D", "Tất cả bằng nhau", "B>A, C>B, D>C, E>D"], 2, "Sách mô tả các chân lớn dần, A nhỏ nhất."),
      question([47,49], "Nhãn cấp lớn của double three là gì?", ["W–X–Y", "A–B–C–D–E", "1–2–3–4–5"], 0, "Trang 47 và mục Double Three dùng W–X–Y để tách khỏi simple corrections."),
      question([51,54], "Triple three dùng chuỗi nhãn nào?", ["A–B–C", "W–X–Y–X–Z", "1–2–3"], 1, "Sách dùng năm thành phần; connector thứ hai còn được gọi X2 ở danh sách trang 52.", "combination"),
      question([54,56], "Trong mẹo bảy nhịp của sách, W/X/Y được đặt ở đâu?", ["Nhịp 1/2/3", "Nhịp 2/4/6", "Nhịp 3/4/7"], 2, "Trang 56 kết luận W ở nhịp 3, X ở nhịp 4, Y ở nhịp 7. Đây là mẹo của tác giả."),
      question([48,49], "Trước khi học complex correction, tác giả khuyên gì?", ["Nhận diện tốt simple corrections trước", "Bỏ qua zigzag và flat", "Luôn tìm complex bên trong complex"], 0, "Trang 48 yêu cầu chắc phần simple; trang 49 cảnh báo ép complex lồng complex gây rối.")
    ]
  },
  {
    id: 4, roman: "IV", title: "ELLIOTT WAVE OPTIMIZATION",
    vi: "Kết hợp công cụ với Elliott Wave", pages: [57,76],
    sections: [
      section("1. Fibonacci Tools", [57,61], "Phân biệt retracement đo nhịp hồi và expansion chiếu mục tiêu từ một pullback. Đọc các nhóm tỷ lệ theo đúng wave trong bảng nguồn; không chuyển chúng thành nội dung tự biên ngoài chương.", ["retracement"]),
      section("2. Elliott Wave Trading With Chart Patterns And Technical Tools", [61,62], "Phần hai đưa ra ba bước tìm setup: High Low Method, Simple Patterns và Indicators. Đây là các cách phối hợp với count đã học."),
      section("Method #1 — Using the High Low Method", [62,64], "Chọn turning point đáng kể, quan sát từ đó đến giá hiện tại, rồi phân loại motive/corrective và đối chiếu quy tắc. Sách khuyên chuyển chart nếu chưa rõ sau khoảng quan sát ngắn."),
      section("Method #2 — Patterns & Elliott Waves", [64,71], "Theo thứ tự nguồn: Head and Shoulders → Double Top → Wedge → Triangle. Đối chiếu số sóng trước hình mẫu để chọn cách diễn giải; tên chart pattern không thay thế phần count."),
      section("Method #3 — Indicators & Elliott Waves", [71,75], "Sách chọn RSI, nhấn mạnh divergence hơn việc chỉ nhìn vùng 30/70. Gold ở Hình 54 cho giá lower low và RSI higher low; quan sát cả hai panel.", ["divergence"]),
      section("Combining All Together!", [75,76], "Phần cuối gộp ba phương pháp, không chọn một phương pháp làm tốt nhất trong mọi trường hợp.")
    ],
    notes: [
      { pages: [60,61], text: "Các khoảng Fib là vùng tác giả theo dõi, không phải bảo đảm giá tới đó. Phụ lục được nhắc ở trang 60 không xuất hiện ở cuối bản PDF 105 trang này." },
      { pages: [40,69], text: "Trang 40 có vị trí triangle 4/B/X; mục wave map ở trang 69 chỉ nhắc 4/B. Câu hỏi luôn chỉ rõ đang hỏi mục nào." },
      { pages: [72,75], text: "Divergence được học như công cụ hỗ trợ theo nguồn; không hứa xác nhận tuyệt đối count hay đảo chiều." }
    ],
    questions: [
      question([58,59], "Hai công cụ Fibonacci chính trong chương IV là gì?", ["RSI và MACD", "Retracement và Expansion/Extensions", "Volume và Moving Average"], 1, "Trang 58–59 tách công cụ tìm điểm hồi và công cụ chiếu mục tiêu."),
      question([58,58], "Sách dùng retracement để tìm điểm cuối tiềm năng của nhóm wave nào?", ["3, 5, C", "1, 3, 5", "2, 4, B, X"], 2, "Trang 58 liệt kê nhóm sóng điều chỉnh 2/4/B/X."),
      question([59,59], "Expansion được dùng cho nhóm wave nào?", ["3, 5, C", "2, 4, B, X", "Chỉ X2"], 0, "Trang 59 liệt kê 3/5/C là các mục tiêu tiềm năng."),
      question([59,59], "Muốn chiếu wave 3 theo ví dụ sách, dùng anchors nào?", ["Chỉ high và low wave 3", "Gốc 1, cuối 1, rồi chiếu từ cuối 2", "Gốc A, cuối B, cuối C"], 1, "Công cụ expansion lấy chiều dài 1 và chiếu từ pullback 2."),
      question([58,58], "Tìm cuối wave 2 bằng retracement thì kéo thước trên chân nào?", ["Wave 5", "Wave C", "Từ đầu đến cuối wave 1"], 2, "Ví dụ công cụ retracement ở trang 58 dùng toàn chân 1.", "retracement"),
      question([60,60], "Vùng hồi wave 4 được tác giả theo dõi là gì?", ["23,6–38,2% wave 3", "100–123,6% wave 2", "Luôn đúng 90% wave 1"], 0, "Trang 60 ghi vùng theo dõi 23,6–38,2% của wave 3, không phải cam kết giá sẽ dừng."),
      question([62,62], "Thứ tự ba bước tìm setup trong sách là gì?", ["Indicators → đặt lệnh → đếm sóng", "High Low → Simple Patterns → Indicators", "Sizing → backtest → MT5"], 1, "Ba bước được đánh số rõ ở đầu trang 62."),
      question([62,64], "High Low Method bắt đầu bằng việc gì?", ["Chọn target trước", "Chọn mức RSI 70", "Tìm turning point đáng kể trên chart"], 2, "Trang 62–63 yêu cầu chọn điểm bắt đầu quan sát trước khi phân loại."),
      question([64,64], "Nếu chưa phân biệt motive/corrective sau khoảng quan sát ngắn, sách khuyên gì?", ["Chuyển sang chart khác", "Ép một count", "Đổi tên mọi nhịp thành impulse"], 0, "Trang 64 nhắc khoảng 10–15 giây và chuyển chart nếu chưa chắc."),
      question([68,69], "Wedge được phần wave map liên hệ với ending diagonal ở đâu?", ["Wave 2 hoặc X", "Wave 5 hoặc C", "Chỉ wave 3"], 1, "Trang 68 nêu hai khả năng: kết thúc 5 hoặc kết thúc C."),
      question([72,73], "Ở Hình 54 Gold, cặp biến động nào tạo divergence?", ["Giá higher high, RSI higher high", "Giá không đổi, RSI bằng 50", "Giá lower low, RSI higher low"], 2, "Trang 73 giải thích giá thấp hơn nhưng oscillator có đáy cao hơn.", "divergence"),
      question([75,76], "Kết luận của 'Combining All Together!' là gì?", ["Có thể kết hợp cả ba phương pháp", "Chỉ dùng RSI", "Bỏ count khi có Fibonacci"], 0, "Sách không chọn riêng một phương pháp là tốt nhất và gợi ý phối hợp ba phương pháp.")
    ]
  },
  {
    id: 5, roman: "V", title: "HOW TO TRADE WITH ELLIOTT WAVE",
    vi: "Cách giao dịch theo phương pháp trong sách", pages: [77,90],
    sections: [
      section("1. Conservative Trading Style", [77,78], "Tác giả giới hạn tần suất conservative, yêu cầu cùng xu hướng lớn, nêu R/R tối thiểu 1:3 và các khung 1H/4H/Daily. Đây là policy của sách, không phải khuyến nghị giao dịch cá nhân."),
      section("How To Trade Impulsive Wave #3 — Conservative", [78,80], "Chuẩn bị sau wave 1 có năm sóng con. Theo dõi entry hồi 50% wave 1, stop tại gốc 1 và các target chiếu từ cuối 2; đọc thêm quản lý ở target đầu.", ["wave3-plan"]),
      section("How To Trade Impulsive Wave #5 — Conservative", [80,81], "Chuẩn bị sau wave 3. Sách dùng hồi 38,2% của 3, hoặc 23,6% khi 3 extended; stop 50% của 3 và target inverse 161,8% của 4.", ["wave5-plan"]),
      section("How to Trade Corrective Wave C — Conservative", [81,83], "A cần có năm sóng con; theo dõi hồi 50% A, stop tại gốc A và target 100% A chiếu từ cuối B."),
      section("2. Aggressive Trading Style", [83,84], "Phần aggressive nêu tần suất 2–3 giao dịch/ngày, R/R tối thiểu 1:2 và khung 15/30 phút. Chỉ ghi nhận sự khác biệt của policy, không áp mức risk thành lời khuyên."),
      section("How To Trade Impulsive Wave #3 — Aggressive", [84,86], "Hai entry tại 50% và 61,8% wave 1, cùng gốc 1 làm stop. Target vẫn dùng 100% và 161,8% wave 1 chiếu từ cuối 2."),
      section("How To Trade Impulsive Wave #5 — Aggressive", [86,88], "Hai entry tại 23,6% và 38,2% wave 3; stop 50% wave 3. Target theo inverse 123,6% và 161,8% wave 4."),
      section("How To Trade Corrective Wave C — Aggressive", [88,90], "Hai entry tại 50% và 61,8% A; stop tại gốc A; target 100% A chiếu từ cuối B. So với conservative, giữ các anchors và chỉ ra số entry thay đổi.", ["wavec-plan"])
    ],
    notes: [
      { pages: [77,84], text: "Các câu tóm tắt 'Best Waves' và một số từ ngữ của sách không khớp hoàn toàn các mục chi tiết 3/5/C. Câu hỏi dùng mục chi tiết, không yêu cầu học thuộc mâu thuẫn." },
      { pages: [78,84], text: "Phần trăm rủi ro do tác giả nêu không phải khuyến nghị của khóa. Trắc nghiệm kiểm tra entry/stop/target và cách tiếp cận, không khuyến khích áp tỷ lệ đó vào tài khoản." }
    ],
    questions: [
      question([77,78], "Conservative yêu cầu quan hệ nào với xu hướng lớn?", ["Luôn ngược xu hướng", "Cùng hướng xu hướng lớn", "Không quan tâm xu hướng"], 1, "Mục Trade with the Trend yêu cầu conservative đi cùng hướng xu hướng lớn."),
      question([78,78], "R/R tối thiểu trong policy conservative của sách là gì?", ["1:1", "1:2", "1:3"], 2, "Trang 78 dùng ví dụ stop 30 pip và target 90 pip để minh họa 1:3."),
      question([79,79], "Entry conservative wave 3 nằm tại đâu?", ["Hồi 50% wave 1", "Hồi 90% wave 3", "Đỉnh wave 5"], 0, "Trang 79 đặt một pending entry tại retracement 50% của 1.", "wave3-plan"),
      question([79,79], "Stop conservative wave 3 lấy mốc nào?", ["Cuối wave 3", "Gốc wave 1", "RSI 30"], 1, "Gốc 1 là mốc stop trong mô tả; wave 2 không được phá gốc đó."),
      question([79,79], "Target wave 3 được chiếu như thế nào?", ["50% của 2 từ cuối 5", "90% của B từ cuối A", "100% và 161,8% của 1 từ cuối 2"], 2, "Trang 79 nêu hai mức target dùng chiều dài 1 và origin chiếu ở cuối 2."),
      question([79,80], "Theo tips wave 3, khi đạt target 100%, tác giả đề nghị gì với stop?", ["Đưa về entry/break-even", "Bỏ stop", "Nới stop gấp đôi"], 0, "Tips ở trang 79 nêu chuyển stop về break-even khi target đầu đạt; đây là policy trong sách."),
      question([80,80], "Entry conservative wave 5 thông thường và ngoại lệ extended 3 là gì?", ["50% và 61,8% wave 1", "38,2% wave 3; 23,6% nếu 3 extended", "90% wave A; 100% nếu A extended"], 1, "Trang 80 phân biệt mức hồi thông thường và ngoại lệ khi 3 mở rộng."),
      question([81,81], "Stop conservative wave 5 được đặt theo mức nào?", ["Gốc wave A", "161,8% wave 1", "Hồi 50% wave 3"], 2, "Trang 81 đặt stop theo mức hồi 50% của wave 3, không dùng gốc wave 1 như kế hoạch wave 3.", "wave5-plan"),
      question([81,81], "Target conservative wave 5 theo sách là gì?", ["Inverse 161,8% wave 4", "Hồi 50% wave 1", "RSI bằng 100"], 0, "Mục Conservative Exit for Wave #5 dùng inverse 161,8% của 4."),
      question([82,82], "Conservative wave C: entry và stop dùng anchors nào?", ["Hồi 50% wave 3; stop cuối 4", "Hồi 50% A; stop gốc A", "Hồi 90% B; không stop"], 1, "Trang 82 dùng A làm chân đo entry và gốc A làm stop."),
      question([83,83], "Target conservative wave C dùng phép chiếu nào?", ["161,8% của 3 từ cuối 4", "50% của B từ gốc A", "100% A từ cuối B"], 2, "Trang 83 nêu 100% extension của A chiếu từ cuối B."),
      question([84,84], "R/R tối thiểu trong policy aggressive của sách là gì?", ["1:2", "1:3", "2:1"], 0, "Trang 84 minh họa stop 20 point và target 40 point."),
      question([85,85], "Hai entry aggressive wave 3 ở đâu?", ["23,6% và 38,2% wave 3", "50% và 61,8% wave 1", "100% và 200% wave 4"], 1, "Trang 85 dùng hai pending entry trên nhịp hồi wave 1."),
      question([87,87], "Hai entry aggressive wave 5 ở đâu?", ["50% và 61,8% wave A", "90% và 100% wave 2", "23,6% và 38,2% wave 3"], 2, "Trang 87 khác entry wave 3 ở chân đo và hai tỷ lệ hồi."),
      question([87,87], "Hai target aggressive wave 5 theo sách là gì?", ["Inverse 123,6% và 161,8% wave 4", "50% và 61,8% wave 1", "90% và 100% wave B"], 0, "Aggressive Exit for Wave #5 nêu hai mức inverse của 4."),
      question([88,89], "Aggressive wave C: bộ entry/stop/target nào đúng theo mục chi tiết?", ["Entry 23,6/38,2% của 3; stop 50% của 3; target inverse 4", "Entry 50/61,8% A; stop gốc A; target 100% A từ cuối B", "Entry RSI 30; stop RSI 0; target RSI 70"], 1, "Mục wave C trang 88–89 dùng A và cuối B làm các anchors.", "wavec-plan")
    ]
  },
  {
    id: 6, roman: "VI", title: "ELLIOTT WAVE APPLICATION IN REAL TRADES",
    vi: "Các ví dụ áp dụng trong sách", pages: [91,104],
    sections: [
      section("Example #1 — Aggressive Buy Trade USD/CHF", [91,92], "Case wave C: A có năm sóng con; entry 50/61,8% A, stop gốc A, target 100% A từ cuối B. Phân biệt nến trong ảnh và đường chấm dự phóng.", ["source-case"]),
      section("Example #2 — Aggressive Sell Trade USD/CAD", [92,94], "Sau nhịp điều chỉnh tăng và nhịp giảm mạnh, tác giả chuẩn bị sell trên nhịp hồi của wave 1; dùng các target chiếu từ cuối 2."),
      section("Example #3 — Aggressive Buy Trade EUR/AUD", [94,96], "Case tiếp tục dùng kế hoạch wave C, hai entry theo A và target từ cuối B. Đối chiếu tiêu đề với nội dung vì tên cặp trong sách không nhất quán."),
      section("Example #4 — Conservative Buy Trade USD/MXN", [96,98], "Wave 3 mạnh dẫn tới kế hoạch vào pullback 4 tại 23,6% của 3, stop 50% của 3 và target inverse 161,8% của 4.", ["wave5-case"]),
      section("Example #5 — Conservative Sell Trade USD/JPY", [98,99], "Ví dụ sell sau nhịp hồi: trang 99 vẫn dùng hai entry 50/61,8% của 1 dù tiêu đề conservative; giữ đúng chi tiết case, không sửa âm thầm cho khớp chương V."),
      section("Example #6 — Conservative Buy Trade USD/CAD", [100,102], "Case dùng hồi 50% A, stop gốc A và target 100% A từ cuối B, với xu hướng lớn được tác giả mô tả là tăng."),
      section("Example #7 — Aggressive Sell Trade AUD/CAD", [102,104], "Sau năm sóng tăng, tác giả chờ A rồi B để chuẩn bị C giảm; hai entry theo A, stop gốc A, target 100% A từ cuối B.")
    ],
    notes: [
      { pages: [94,95], text: "Example #3 ghi EUR/AUD trong tiêu đề nhưng đoạn văn ghi EURNZD. Câu hỏi chỉ kiểm tra kế hoạch, không bắt chọn một tên cặp là chắc chắn đúng." },
      { pages: [98,99], text: "Example #5 mang tên conservative nhưng dùng hai mức entry; câu hỏi chỉ rõ đang hỏi case trang 99." },
      { pages: [91,104], text: "Đây là ví dụ được tác giả chọn sau sự kiện; kết quả được kể trong sách không tự cung cấp tỷ lệ thắng hay bằng chứng hiệu quả tổng quát." }
    ],
    questions: [
      question([91,92], "Example #1 USD/CHF nhắm giao dịch wave nào?", ["Wave 2", "Wave C", "Wave X2"], 1, "Tác giả dựa vào A năm sóng con để chọn kế hoạch C của zigzag.", "source-case"),
      question([91,92], "Target của Example #1 được lấy thế nào?", ["50% wave 3", "Inverse 161,8% wave 4", "100% A chiếu từ cuối B"], 2, "Trang 92 kết thúc mô tả case với target 100% extension A từ B."),
      question([93,93], "Example #2 USD/CAD dùng chân nào để đo hai entry 50/61,8%?", ["Wave 1", "Wave 4", "Wave B"], 0, "Trang 93 ghi hai entry theo retracement wave 1; targets chiếu từ cuối 2."),
      question([95,95], "Example #3 dùng stop tại đâu?", ["Cuối wave 5", "Gốc wave A", "Đỉnh RSI"], 1, "Dù tên cặp không nhất quán, mô tả stop ở trang 95 rõ là start of Wave A."),
      question([97,97], "Example #4 USD/MXN chọn mức entry nào?", ["50% wave A", "61,8% wave 1", "23,6% wave 3"], 2, "Case dùng pullback wave 4 và mức hồi nông của 3.", "wave5-case"),
      question([97,97], "Stop và target của Example #4 là gì?", ["Stop 50% wave 3; target inverse 161,8% wave 4", "Stop gốc A; target 100% A", "Không stop; target RSI 70"], 0, "Đọc đúng cặp anchors trong mô tả trang 97, không lấy từ case wave C."),
      question([99,99], "Riêng Example #5 USD/JPY, sách ghi bao nhiêu mức entry?", ["Một mức 38,2% wave 3", "Hai mức 50% và 61,8% wave 1", "Ba mức RSI"], 1, "Trang 99 dùng hai mức dù tiêu đề case là conservative; câu hỏi không sửa chi tiết nguồn."),
      question([101,101], "Example #6 USD/CAD dùng entry nào?", ["23,6% wave 3", "61,8% wave B", "50% wave A"], 2, "Trang 101 ghi một entry 50% A, stop gốc A và target từ cuối B."),
      question([103,103], "Example #7 AUD/CAD chờ chân nào để xác định vị trí chuẩn bị trade C?", ["Wave B", "Wave X2", "Wave 5 mới"], 0, "Sau nhịp A đầu tiên, tác giả chờ B để đặt kế hoạch C giảm."),
      question([103,104], "Example #7 dùng target nào?", ["Inverse 161,8% wave 4", "100% A chiếu từ cuối B", "50% wave 3"], 1, "Trang 103 mô tả target wave C; trang 104 kể kết quả case.")
    ]
  }
];

export function validateChapters() {
  const bounds = [[9,12],[13,27],[28,56],[57,76],[77,90],[91,104]];
  const ids = new Set();
  for (const [index, chapter] of chapters.entries()) {
    if (chapter.id !== index + 1 || chapter.pages.join() !== bounds[index].join()) throw new Error("Invalid PDF chapter order or boundaries");
    for (const entry of [...chapter.sections, ...chapter.questions]) {
      const [start, end] = entry.pages;
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < chapter.pages[0] || end > chapter.pages[1] || start > end) throw new Error(`Chapter ${chapter.id}: reference outside chapter`);
    }
    for (const note of chapter.notes) if (note.pages[0] < 1 || note.pages[1] > 105 || note.pages[0] > note.pages[1]) throw new Error("Invalid source-note page");
    for (const item of chapter.questions) {
      if (ids.has(item.prompt) || item.options.length !== 3 || new Set(item.options).size !== 3 || !Number.isInteger(item.correct) || !item.options[item.correct] || !item.explanation) throw new Error(`Invalid quiz in chapter ${chapter.id}`);
      ids.add(item.prompt);
    }
  }
  if (chapters.length !== 6) throw new Error("Expected exactly six source chapters");
}
