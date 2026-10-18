export const quizzes = {
  16: [
    {
      prompt: "Thấy 7 swing trong vùng đi ngang, có thể kết luận gì? / What do seven sideways swings establish?",
      options: ["Chắc chắn W–X–Y / Certain WXY", "Chỉ là quan sát; cần kiểm tra các khối / Observation; inspect blocks", "Chắc chắn impulse / Certain impulse"],
      correct: 1,
      explanation: "Bảy swing không tự chứng minh double three; phải kiểm tra cấu trúc W, X, Y và degree. / Seven swings alone do not prove a combination; constituent structure and degree matter."
    },
    {
      prompt: "Trong W–X–Y–X–Z có bao nhiêu khối điều chỉnh chính và khối nối X? / How many main corrective blocks and X connectors?",
      options: ["2 chính, 3 nối / 2 main, 3 connectors", "5 chính, 0 nối / 5 main, 0 connectors", "3 chính, 2 nối / 3 main, 2 connectors"],
      correct: 2,
      explanation: "W, Y, Z là ba khối điều chỉnh được nối bởi hai X; năm nhãn không phải năm sóng impulse. / Three corrective components are linked by two X waves, not an impulse."
    },
    {
      prompt: "W là zigzag, X hồi, Y có vẻ flat; bước tiếp theo là gì? / W is a zigzag and Y looks flat; what next?",
      options: ["Mở internals của Y và kiểm tra flat / Inspect Y's flat internals", "Ép Y thành zigzag / Force Y into a zigzag", "Bỏ degree vì đã có WXY / Ignore degree"],
      correct: 0,
      explanation: "Nhãn WXY chỉ là bản đồ khối; Y vẫn phải có bằng chứng của constituent pattern và cùng cấp phù hợp. / A block label does not validate Y's internal pattern or degree."
    },
    {
      prompt: "Hai zigzag nối bằng X cùng đẩy giá giảm rõ rệt khác tổ hợp đi ngang thế nào? / How does a directional double zigzag differ from a sideways combination?",
      options: ["Cứ có X thì đều đi ngang / Any X means sideways", "Mọi khối đều phải là flat / Every block must be flat", "Không cần xem hình con / Ignore internal structures", "So sánh constituent patterns và tiến triển giá / Compare constituents and price progress"],
      correct: 3,
      explanation: "Cả hai có thể dùng WXY nhưng chức năng và constituent patterns khác nhau; ký hiệu không đủ để phân loại. / Shared WXY notation does not make their structures or directional progress identical."
    },
    {
      prompt: "W dùng degree H4 nhưng các nhãn X, Y lại là từng swing con H1; lỗi chính là gì? / W is H4-degree while X and Y label H1 subwaves; what is wrong?",
      options: ["Thiếu RSI trên 70 / Missing RSI above 70", "Trộn cấp cấu trúc / Inconsistent degree", "Có quá ít mức Fib / Too few Fib levels"],
      correct: 1,
      explanation: "Timeframe không tự quyết định degree; các khối WXY phải được so ở cùng cấp, không lấy con của W làm khối ngang hàng. / Compare peer components, not a parent with its subwaves."
    },
    {
      prompt: "Vùng choppy chưa phân giải được W và Y nên ghi gì và dùng kiểm tra nào? / What should an unresolved choppy region be called and checked with?",
      options: ["Complex, unresolved; lưu swing và nhận xét thủ công / Preserve swings; manual review", "Impulse hợp lệ nếu checker xanh / Valid impulse if checker passes", "Tự thêm pivot cho đủ 7 / Add pivots until seven"],
      correct: 0,
      explanation: "Giữ nhãn chưa giải quyết trung thực hơn ép count; impulse checker không chứng nhận double/triple three. / Preserve uncertainty; an impulse checker cannot certify a complex correction."
    }
  ],
  17: [
    {
      prompt: "A giảm 2400→2350, B lên 2396; B hồi bao nhiêu A và đủ gọi flat chưa? / What is B's retracement, and does it prove a flat?",
      options: ["46%, đủ / 46%, sufficient", "108%, đủ / 108%, sufficient", "92%, còn cần internals / 92%, inspect internals"],
      correct: 2,
      explanation: "A dài 50, B hồi 46 nên 46/50=92%; độ sâu chỉ hỗ trợ, còn cần A/B điều chỉnh và C thích hợp. / Depth is 92%, but it does not establish the full flat structure."
    },
    {
      prompt: "A giảm 2400→2340, B lên 2370; phép tính B và bước phân loại nào đúng? / Compute B and choose the next classification step.",
      options: ["50%; kiểm tra A và C cùng bối cảnh / 50%; inspect A, C and context", "150%; chắc expanded flat / 150%; certain expanded flat", "30%; chỉ nhìn endpoint / 30%; endpoints only"],
      correct: 0,
      explanation: "B hồi 30 trên A dài 60, bằng 50%; cần internals để đánh giá zigzag hay phương án khác. / B retraces half of A; structure is still required to classify the correction."
    },
    {
      prompt: "Hai chart có cùng endpoint ABC nhưng A một bên 5 sóng, bên kia 3 sóng; có nên cho cùng kết luận? / Identical ABC endpoints, different A internals: same conclusion?",
      options: ["Có, endpoint quyết định hết / Yes, endpoints decide", "Có, nếu C cùng giá / Yes, if C matches", "Có, nếu cùng màu nến / Yes, matching candle colors", "Không; internals thay đổi giả thuyết / No; internals change the hypothesis"],
      correct: 3,
      explanation: "A motive hỗ trợ zigzag, còn A điều chỉnh khiến cần xét flat/complex hoặc unknown; cùng hình ngoài không đủ. / Different A structures change viable patterns despite matching endpoints."
    },
    {
      prompt: "Ở nhánh wave 2, một hình giống triangle độc lập nên xử lý ra sao? / How should a standalone triangle-looking wave 2 be handled?",
      options: ["Chấp nhận vì có 5 chân / Accept because it has five legs", "Bác nhãn triangle độc lập tại wave 2, xét lại count / Reject that placement and reassess", "Đổi tên thành wave 3 ngay / Rename it wave 3"],
      correct: 1,
      explanation: "Vị trí là bộ lọc bắt buộc; không gán triangle độc lập vào wave 2 chỉ vì hình giống mẫu. / Pattern resemblance cannot override the roadmap's wave-2 placement restriction."
    },
    {
      prompt: "Bộ 10 case có 3 zigzag, 3 flat, 2 triangle, 2 thiếu dữ liệu; xử lý 2 case cuối thế nào? / How should the two insufficient-data cases be handled?",
      options: ["Chọn flat để đủ mẫu / Label flat to complete the set", "Loại khỏi sổ mà không ghi / Silently discard them", "Ghi no-count và nêu dữ liệu thiếu / Record no-count and missing evidence"],
      correct: 2,
      explanation: "Decision tree cần nhánh chưa biết; thiếu internals không phải lý do ép một pattern cho mọi case. / An explicit unknown branch prevents forced classification."
    },
    {
      prompt: "Chuỗi kiểm tra correction nào hợp lý nhất? / Which correction decision sequence is most defensible?",
      options: ["A structure → B depth → C structure → vị trí/degree, cho phép chưa biết / Allow unknown", "Tên hình → mục tiêu lợi nhuận → bỏ internals / Shape then profit target", "RSI → nhãn chắc chắn → tìm bằng chứng sau / Label first, justify later"],
      correct: 0,
      explanation: "Cần phối hợp internals, độ hồi và bối cảnh; nếu bằng chứng mâu thuẫn thì giữ alternative hoặc no-count. / Combine structural and contextual evidence rather than forcing a label."
    }
  ],
  18: [
    {
      prompt: "Nhịp tăng 2300→2400, mức hồi 38,2% là giá nào? / Where is the 38.2% retracement of this rise?",
      options: ["2338,2 / 2338.2", "2361,8 / 2361.8", "2438,2 / 2438.2"],
      correct: 1,
      explanation: "Từ đỉnh 2400 trừ 0,382×100 được 2361,8; correction đi ngược nhịp tăng. / Subtract 38.2 from the high, not add it to the low."
    },
    {
      prompt: "Nhịp giảm 2400→2300, hồi lên 61,8% nằm ở đâu? / Where is a 61.8% upward retracement of this decline?",
      options: ["2338,2 / 2338.2", "2238,2 / 2238.2", "2361,8 / 2361.8", "2461,8 / 2461.8"],
      correct: 2,
      explanation: "Đo từ đáy 2300 cộng 0,618×100 được 2361,8; đảo chiều nhịp gốc thì dấu hồi cũng đảo. / Add 61.8 to the decline's endpoint."
    },
    {
      prompt: "Nhịp tăng 2300→2400 rồi về 2360: tỷ lệ hồi thực tế là bao nhiêu? / What fraction of the rise has been retraced?",
      options: ["40% / 40 percent", "60% / 60 percent", "4% / 4 percent"],
      correct: 0,
      explanation: "Khoảng lùi là 2400−2360=40 trên nhịp dài 100, nên hồi 40%, không phải phần tăng còn lại 60%. / Retracement measures the pullback, not the retained advance."
    },
    {
      prompt: "Với hai neo đầu S, cuối E và tỷ lệ r, công thức hồi nào đúng cho cả hai chiều? / Which retracement formula works in both directions?",
      options: ["E+r×(E−S)", "S+r×(E−S)", "|E−S|×r", "E−r×(E−S)"],
      correct: 3,
      explanation: "Vector E−S có dấu; trừ một phần vector khỏi E cho mức hồi ngược chiều nhịp gốc. / Subtracting the signed fraction from E handles both rises and declines."
    },
    {
      prompt: "Giá chạm mức 50% thì phát biểu nào chính xác? / What does touching the 50% level mean?",
      options: ["Chắc chắn wave 2 xong / Wave 2 certainly ended", "Là mức hồi tham khảo, không phải tỷ lệ Fibonacci thuần / Reference level, not a pure Fibonacci ratio", "Mọi correction phải dừng đó / Every correction must stop there"],
      correct: 1,
      explanation: "50% là quy ước đo phổ biến; mức giá không định danh sóng và không chứng minh correction đã xong. / A commonly used midpoint is neither a wave label nor completion evidence."
    },
    {
      prompt: "Nhịp giảm 2400→2300 có mức hồi 38,2% ở 2338,2; giá bật 2340. Nên đổi neo để khớp không? / Should anchors be moved to force a Fib match?",
      options: ["Có, cho mức đúng giá / Yes, fit the level", "Đổi sang close bất kỳ / Use any close", "Không; giữ neo, ghi sai khác 1,8 / No; preserve anchors and record 1.8 difference"],
      correct: 2,
      explanation: "Neo phản ánh swing đã chọn, không phải nút tối ưu tỷ lệ sau kết quả; 2340 khác 2338,2 là sai khác cần ghi. / Preserve the measurement rather than retrofitting it."
    }
  ],
  19: [
    {
      prompt: "Đo 2300→2400, đặt từ pullback 2350: projection 161,8% là bao nhiêu? / Project 161.8% from the pullback endpoint.",
      options: ["2511,8 / 2511.8", "2561,8 / 2561.8", "2411,8 / 2411.8"],
      correct: 0,
      explanation: "Vector gốc +100 được nhân 1,618 rồi cộng tại 2350: 2350+161,8=2511,8. / Measure the first leg, then place the signed projection at the third anchor."
    },
    {
      prompt: "Đo 2400→2300, đặt từ 2350: projection 100% và 161,8% là gì? / Compute both downward projections.",
      options: ["2450 và 2511,8 / 2450 and 2511.8", "2300 và 2238,2 / 2300 and 2238.2", "2250 và 2188,2 / 2250 and 2188.2"],
      correct: 2,
      explanation: "Vector −100 cho 2350−100=2250 và 2350−161,8=2188,2; lấy độ dài tuyệt đối rồi cộng sẽ sai hướng. / Preserve the negative sign."
    },
    {
      prompt: "Với đầu A, cuối B và điểm đặt C, công thức projection nào đúng? / Which three-anchor formula is correct?",
      options: ["B+r×(C−A)", "C+r×(B−A)", "A+r×|C−B|", "C−r×(B−A)"],
      correct: 1,
      explanation: "A→B cung cấp vector có dấu, C là điểm đặt; thay C bằng B sẽ chiếu sai reference. / The measured leg and the placement anchor have different roles."
    },
    {
      prompt: "Nhịp 2300→2400 hồi 2350; tính 100% từ 2400 ra 2500 sai ở đâu? / Why is projecting equality from 2400 to 2500 wrong here?",
      options: ["100% luôn không hợp lệ / Equality is always invalid", "Phải lấy 50% thay 100% / Must use 50%", "Phải chiếu từ 2300 / Must project from 2300", "Dùng đỉnh1 thay điểm2 giả định; đúng là 2450 / Wrong placement; use 2350 for 2450"],
      correct: 3,
      explanation: "Độ dài 100 vẫn đúng nhưng điểm đặt sai; projection wave 3 dùng điểm kết thúc pullback theo giả thuyết. / Correct length cannot compensate for an incorrect third anchor."
    },
    {
      prompt: "Ở cutoff hiện tại chưa biết đáy pullback; được ghi mức 2511,8 như thế nào? / How may a target based on an unconfirmed pullback low be recorded?",
      options: ["Mức có điều kiện nếu neo 2350 được xác nhận / Conditional on the 2350 anchor", "Mục tiêu chắc chắn từ đáy tương lai / Certain target using the future low", "Bằng chứng lệnh đã khớp / Proof of a fill"],
      correct: 0,
      explanation: "Endpoint chỉ biết sau xác nhận; trước đó cần ghi giả định và timestamp, không dùng tương lai như thông tin sẵn có. / An assumed anchor produces a conditional level, not known evidence."
    },
    {
      prompt: "Trong 5 worksheet projection wave 3/C, chart sau đó chạm target. Điều gì vẫn chưa được chứng minh? / A projected level is later touched; what remains unproven?",
      options: ["Phép cộng có dùng neo hay không / Whether addition uses anchors", "Vector có thể có dấu âm / Whether a vector can be negative", "Fill và kết quả giao dịch thực thi / Execution fills and trade results"],
      correct: 2,
      explanation: "Target candidate không phải giao dịch; muốn xác nhận fill còn cần điều kiện lệnh và dữ liệu thực thi. / A price-level touch alone establishes neither an executable fill nor a profit."
    }
  ],
  20: [
    {
      prompt: "Wave 1 tăng dài 40, điểm4 ở 2350; equality wave 5 cho giá nào? / Compute a wave-1 equality target from point 4.",
      options: ["2310 / 2310", "2390 / 2390", "2414,72 / 2414.72"],
      correct: 1,
      explanation: "Dự phóng wave 5 cùng chiều tăng lấy 2350+40=2390; đây là quan hệ độ dài tham khảo. / Equality places one wave-1 length above point 4, not a guaranteed endpoint."
    },
    {
      prompt: "Wave 4 giảm 2390→2350; quy ước chiếu lên 1,618 lần độ dài từ 2350 cho giá nào? / Project upward using the stated wave-4-length convention.",
      options: ["2285,28 / 2285.28", "2390 / 2390", "2414,72 / 2414.72", "2454,72 / 2454.72"],
      correct: 2,
      explanation: "Theo quy ước chiếu lên đã nêu, lấy 2350+1,618×|2350−2390|=2414,72. / This explicit upward absolute-length formula differs from blindly projecting the negative wave-4 vector."
    },
    {
      prompt: "Hai mức 2390 và 2414,72 có thành một vùng với tolerance tối đa 5 giữa hai mức không? / Do these levels meet a maximum five-point separation rule?",
      options: ["Không, chúng cách 24,72 / No; separation is 24.72", "Có vì cùng dự báo tăng / Yes; both bullish", "Có vì đều dùng Fib / Yes; both use Fib"],
      correct: 0,
      explanation: "2414,72−2390=24,72 lớn hơn 5; không mở rộng tolerance sau khi nhìn giá để tạo confluence. / The predeclared tolerance rejects this pair."
    },
    {
      prompt: "Tool gọi một phép đo là “inverse”; cần ghi gì trước khi so sánh kết quả? / What must be documented when a tool calls a measurement “inverse”?",
      options: ["Chỉ tên tool / Tool name only", "Màu đường / Line color", "Mức nào gần giá nhất / Nearest level", "Công thức, hướng và các neo / Formula, direction and anchors"],
      correct: 3,
      explanation: "Tên inverse có thể dùng cho các quy ước khác nhau; công thức và neo làm phép đo tái lập được. / Terminology alone does not specify the operation."
    },
    {
      prompt: "Ba mức từ cùng một cặp neo gần nhau có nghĩa là ba xác nhận độc lập không? / Are three nearby levels from shared anchors independent confirmations?",
      options: ["Có, cứ ba đường là mạnh gấp ba / Yes, threefold strength", "Không; chúng có thể lặp lại cùng thông tin / No; evidence may be dependent", "Có, nếu tô ba màu / Yes, if differently colored"],
      correct: 1,
      explanation: "Các phép đo dùng chung đầu vào có thể tương quan; confluence không tự tạo bằng chứng độc lập hay chắc chắn. / Shared inputs can duplicate information rather than multiply confidence."
    },
    {
      prompt: "Đã khóa tolerance 5; sau reveal thấy giá đảo cách vùng 12 điểm. Cách báo cáo nào đúng? / A reversal occurs 12 points away after reveal; how should it be reported?",
      options: ["Đổi tolerance lên 15 rồi ghi hit / Widen to 15 and claim a hit", "Xóa worksheet / Delete the worksheet", "Ghi không khớp tiêu chí cũ, giữ bản gốc / Record a miss under the original rule"],
      correct: 2,
      explanation: "Tolerance được chọn trước để tránh cherry-pick; thay đổi chỉ dùng cho thử nghiệm mới có lưu phiên bản. / Post-outcome widening cannot validate the original zone."
    }
  ],
  21: [
    {
      prompt: "Hai đỉnh 2400 và 2398 có tự chứng minh flat 3–3–5 không? / Do these two nearby peaks establish a 3–3–5 flat?",
      options: ["Không; cần internals và cấu trúc trước đó / No; inspect internals and prior context", "Có vì lệch đúng 2 / Yes; two-point difference", "Có nếu đỉnh sau thấp hơn / Yes; lower second peak"],
      correct: 0,
      explanation: "Double top là hình dạng, không phải bộ dịch nhãn; có thể là B-retest, wave5 candidate hoặc range. / Similar peaks admit several wave maps."
    },
    {
      prompt: "Bản đồ A xem đỉnh 2398 là B-retest; bản đồ B xem là wave5 candidate. Cần ghi thêm gì? / What must accompany these alternative maps?",
      options: ["Chỉ chọn bản đồ có target cao hơn / Pick the higher target", "Đợi kết quả rồi xóa bản sai / Delete the wrong map afterward", "Evidence và điều kiện bác bỏ từng map / Evidence and invalidation for each"],
      correct: 2,
      explanation: "Alternative có ích khi có thể bị bác bỏ bằng dữ liệu; hai tên nhãn không kèm điều kiện chỉ là suy đoán. / Each map needs testable supporting evidence and failure conditions."
    },
    {
      prompt: "Bốn shape trên H4 được kiểm tra internals H1; phải dùng cutoff nào? / Which cutoff should the H1 inspection use?",
      options: ["Thêm 10 nến H1 tương lai / Ten future H1 candles", "Cùng mốc quan sát với H4 / The same observation cutoff", "Đến khi thấy target / Until target is visible"],
      correct: 1,
      explanation: "H1 giúp mở cấu trúc trong dữ liệu đã biết, không được bổ sung nến sau cutoff để xác nhận H4. / Lower-timeframe inspection must not leak future information."
    },
    {
      prompt: "Một wedge ở cuối nhịp tăng có đủ để gọi ending diagonal không? / Is an end-of-rise wedge enough to label an ending diagonal?",
      options: ["Có, mọi wedge đều là diagonal / Every wedge is a diagonal", "Có nếu đường biên đẹp / Yes, clean trendlines", "Có nếu có đúng 2 đường biên / Yes, two boundaries", "Không; cần vị trí và internals phù hợp / No; inspect position and internals"],
      correct: 3,
      explanation: "Wedge là gợi ý tìm kiếm; nhãn Elliott cần parent context và kiểm tra cấu trúc, không chỉ hình học. / Shape resemblance alone cannot certify a diagonal."
    },
    {
      prompt: "Hai đáy 2330/2332 giống double bottom nhưng internals không hỗ trợ map dự định. Nên ghi gì? / A double-bottom shape fails internal checks; what should be recorded?",
      options: ["False-positive rejection của map / Reject the unsupported map", "Đổi mọi nhãn con để khớp / Relabel all subwaves to fit", "Bỏ kiểm tra vì lệch chỉ 2 / Ignore checks; only two points apart"],
      correct: 0,
      explanation: "Độ gần hai đáy không bù được bằng chứng cấu trúc thiếu hoặc mâu thuẫn; ghi ca bị bác thay vì ép nhãn. / A visually attractive shape can still be a false positive."
    },
    {
      prompt: "H&S nhìn rõ nhưng parent count chưa xác định; vai trò phù hợp của shape là gì? / What role can a clear head-and-shoulders shape play with unresolved parent context?",
      options: ["Tự động xác nhận ABC / Automatically certify ABC", "Gợi ý vùng cần khảo sát, giữ nhiều map / Guide inspection while retaining alternatives", "Bảo đảm đảo chiều / Guarantee reversal"],
      correct: 1,
      explanation: "Turning-point pattern có thể định hướng tìm kiếm, nhưng không quyết định wave degree hay đảm bảo hướng giá tiếp. / Use it as context, not an automatic wave label or forecast."
    }
  ],
  22: [
    {
      prompt: "Hai đỉnh giá 2380→2400, RSI tương ứng 72→64 biểu thị gì? / What does this price–RSI pairing suggest?",
      options: ["Bullish divergence chắc chắn / Certain bullish divergence", "Bearish divergence candidate / Ứng viên phân kỳ giảm", "Wave5 chắc chắn hoàn tất / Wave 5 certainly completed"],
      correct: 1,
      explanation: "Giá higher high nhưng RSI lower high là phân kỳ giảm tiềm năng; chưa chứng minh wave5 hay đảo chiều. / Momentum disagreement supports a candidate, not a trade or wave label."
    },
    {
      prompt: "Hai đáy giá 2350→2335, RSI tương ứng 29→36 được gọi là gì? / Name the divergence at these corresponding lows.",
      options: ["Không thể có vì RSI dưới 50 / Impossible below RSI 50", "Bearish divergence / Phân kỳ giảm", "Bullish divergence candidate / Ứng viên phân kỳ tăng"],
      correct: 2,
      explanation: "Giá lower low trong khi RSI higher low cho ứng viên phân kỳ tăng; tín hiệu có thể kéo dài mà giá vẫn giảm. / A higher oscillator low does not guarantee an immediate reversal."
    },
    {
      prompt: "Không có divergence giữa hai đỉnh có tự hủy một impulse hợp quy tắc không? / Does absent divergence invalidate an otherwise rule-consistent impulse?",
      options: ["Không; RSI chỉ là bằng chứng phụ / No; RSI is supporting evidence", "Có; divergence là hard rule / Yes; divergence is mandatory", "Có nếu RSI chưa chạm 70 / Yes if RSI never reaches 70"],
      correct: 0,
      explanation: "Hard rules thuộc cấu trúc giá; thiếu phân kỳ RSI không phải vi phạm impulse. / Oscillator behavior is not a substitute for structural invalidation."
    },
    {
      prompt: "Muốn tái lập ba cặp giá/RSI theo unit 22 cần ghi gì? / What records make the RSI comparisons reproducible?",
      options: ["Chỉ ảnh có đường RSI / Only an RSI screenshot", "Chỉ mức 70/30 / Only thresholds", "Tự ước lượng từ độ dốc giá / Estimate from price slope", "RSI(14), Wilder, close, warm-up và timestamps / Settings and aligned times"],
      correct: 3,
      explanation: "Settings, warm-up và timestamp quyết định giá trị so sánh; phải lấy RSI tính được, không dựng từ ảnh. / Reproducibility requires actual oscillator data and its computation settings."
    },
    {
      prompt: "Đỉnh giá tại 10:00 và 14:00 nhưng lấy RSI lúc 11:00 và 15:00 có ổn không? / May RSI from shifted timestamps be used for these price pivots?",
      options: ["Có vì cùng ngày / Yes, same day", "Không; phải so pivot tương ứng cùng timestamp / No; align corresponding pivots", "Có nếu tạo divergence rõ hơn / Yes, if clearer"],
      correct: 1,
      explanation: "Dịch timestamp có thể tạo phân kỳ giả; so RSI tại các pivot giá tương ứng với cùng quy ước. / Misaligned observations can manufacture momentum disagreement."
    },
    {
      prompt: "Có bearish divergence liên tiếp nhưng giá vẫn tăng; quyết định nào đúng? / Price keeps rising despite repeated bearish divergence; what follows?",
      options: ["Tăng vị thế vì RSI không thể sai / Add exposure; RSI cannot fail", "Bán ngay không cần stop / Sell without a stop", "Giữ tiêu chí cấu trúc/trigger; có thể no-trade / Keep structure and trigger rules; allow no-trade"],
      correct: 2,
      explanation: "Divergence có thể kéo dài và không phải lệnh; cần điều kiện kế hoạch riêng thay vì ép thị trường đảo chiều. / Supporting momentum evidence cannot replace an entry and risk plan."
    }
  ],
  23: [
    {
      prompt: "Wave1 giả định 2300→2400, giá chạm 2350. Điều đó đủ mua wave3 chưa? / Does touching the 2350 pullback zone justify a wave-3 entry?",
      options: ["Chưa; vùng hồi không chứng minh wave2 xong / No; a zone does not prove completion", "Đủ vì hồi đúng 50% / Yes; exactly 50%", "Đủ nếu tăng size / Yes with larger size"],
      correct: 0,
      explanation: "Vùng giá và trigger là hai việc khác nhau; cần quy trình limit/confirmation đã định, parent alignment và kiểm tra wave1. / A Fibonacci touch alone is not an entry condition."
    },
    {
      prompt: "Nếu điểm2 giả định được xác định ở 2350 sau nhịp1 +100, hai projection 100%/161,8% là gì? / Compute the conditional wave-3 projections.",
      options: ["2400 / 2461,8", "2450 / 2511,8", "2500 / 2561,8"],
      correct: 1,
      explanation: "Từ neo2 2350 cộng 100 và 161,8; kết quả có điều kiện theo neo này, không bảo đảm wave3 sẽ đạt. / These levels depend on the assumed pullback endpoint."
    },
    {
      prompt: "Tại 10:00 chưa biết đáy2; sau 12:00 mới thấy đáy đẹp. Lỗi nào nếu ghi đã biết đáy lúc 10:00? / What error is using the later low in the earlier plan?",
      options: ["Sai số làm tròn / Rounding error", "Volume step / Bước khối lượng", "Hindsight / Dùng thông tin tương lai"],
      correct: 2,
      explanation: "Kế hoạch pre-reveal chỉ dùng dữ liệu tới cutoff; đáy nhận ra sau không được hồi tố thành bằng chứng lúc vào lệnh. / Later confirmation cannot be backdated."
    },
    {
      prompt: "Kế hoạch long wave3 có stop giao dịch cao hơn mốc structural invalidation. Hai mốc có bắt buộc giống nhau không? / Must the trade stop equal structural invalidation?",
      options: ["Có, mọi stop đều là hard rule / Every stop is a hard rule", "Có, nếu dùng Fib / Yes when using Fib", "Không, nên bỏ cả hai / No; omit both", "Không; phải ghi rõ chức năng từng mốc / No; document each role"],
      correct: 3,
      explanation: "Stop quản lý rủi ro lệnh, invalidation bác giả thuyết cấu trúc; stop bị chạm có thể chưa hủy count. / Trade risk and structural validity are distinct."
    },
    {
      prompt: "Plan limit hết hạn 15:00, chưa khớp; 16:00 giá chạy nhanh lên. Nên làm gì? / An unfilled limit plan expires before price runs upward; what next?",
      options: ["Hủy theo expiry, không chase ngoài quy tắc / Cancel; do not chase outside policy", "Ghi khớp tại limit cũ / Claim the old fill", "Đuổi giá bất kể risk / Chase regardless of risk"],
      correct: 0,
      explanation: "Expiry và no-chase phải có trước reveal; bỏ lỡ một nhịp vẫn là kết quả hợp lệ của kế hoạch. / An expired setup does not authorize a retrospective fill or impulsive entry."
    },
    {
      prompt: "Trong 3 wave3 plans, parent context và internals wave1 còn thiếu. Cách nộp nào hợp lệ? / How should plans with missing structural evidence be submitted?",
      options: ["Điền count chắc chắn để đủ 3 lệnh / Force three trades", "No-trade có timestamp, dữ liệu thiếu và điều kiện xét lại / Document missing evidence and review conditions", "Dùng RSI thay toàn bộ wave1 / Replace wave1 checks with RSI"],
      correct: 1,
      explanation: "Ba plans không bắt buộc ba giao dịch; ghi điều thiếu cùng trigger, invalidation, stop và expiry giúp giả thuyết kiểm thử được. / A documented no-trade preserves decision discipline."
    }
  ],
  24: [
    {
      prompt: "Equity giả định 10000, budget 0,5%: tổng tiền được lập ngân sách rủi ro là bao nhiêu? / Compute the cash risk budget.",
      options: ["5 / 5", "500 / 500", "50 / 50"],
      correct: 2,
      explanation: "10000×0,005=50 đơn vị tiền tài khoản; đây là tổng budget cho các lệnh có thể cùng khớp. / The percentage applies to aggregate planned exposure, not separately to every leg."
    },
    {
      prompt: "Distance 5, contract giả định 10 oz/lot, conversion 1, costs 2/lot: modeled risk mỗi lot là gì? / Compute modeled risk per lot.",
      options: ["52 / 52", "50 / 50", "12 / 12", "500 / 500"],
      correct: 0,
      explanation: "5×10×1+2=52 tiền/lot; costs được cộng vào tổn thất theo stop, không bỏ qua. / Multiply distance, contract and conversion, then add modeled per-lot costs."
    },
    {
      prompt: "Budget 50, risk/lot 52, step 0,01: chọn volume và modeled risk nào? / Choose the correctly rounded volume and risk.",
      options: ["0,97 lot; 50,44 / 0.97 lot; 50.44", "1 lot; 52 / 1 lot; 52", "0,95 lot là mức tối đa / 0.95 is the maximum", "0,96 lot; 49,92 / 0.96 lot; 49.92"],
      correct: 3,
      explanation: "50/52≈0,961538; làm tròn xuống step 0,01 cho 0,96 và 0,96×52=49,92. / Rounding upward would exceed the budget."
    },
    {
      prompt: "Hai lệnh đều có thể khớp, budget tổng 50; chia đều thì mỗi lệnh được bao nhiêu? / Split the aggregate budget equally between two potentially filled orders.",
      options: ["50 mỗi lệnh / 50 each", "25 mỗi lệnh / 25 each", "100 mỗi lệnh / 100 each"],
      correct: 1,
      explanation: "Hai lệnh cùng tồn tại phải cộng rủi ro; 25+25=50, còn 50+50 nhân đôi budget. / Pending orders do not each receive the entire aggregate allowance."
    },
    {
      prompt: "Không biết contract XAUUSDm, có được dùng 10 oz/lot từ ví dụ giả định để báo size thực không? / Can the hypothetical contract be reused as a real broker specification?",
      options: ["Có, mọi symbol vàng giống nhau / All gold symbols match", "Có, vì hậu tố m / Yes, suffix m", "Không; ghi unavailable, dừng kết luận size thực / No; mark unavailable"],
      correct: 2,
      explanation: "Thông số minh họa không phải đặc tả broker; tên symbol không chứng minh contract, conversion hay volume limits. / Real sizing requires verified specifications."
    },
    {
      prompt: "Budget 30, risk/lot 80, step 0,1 và min 0,1 giả định: volume tối đa không vượt budget là gì? / Compute the step-compliant maximum size.",
      options: ["0,3 lot, modeled risk 24 / 0.3 lot, risk 24", "0,4 lot, risk 32 / 0.4 lot, risk 32", "0,375 lot dù sai step / 0.375 despite step"],
      correct: 0,
      explanation: "30/80=0,375 lot; làm tròn xuống theo step 0,1 còn 0,3. Rủi ro mô hình là 24, không bảo đảm lỗ thực bị chặn khi gap. / Size down; modeled risk is not a fill guarantee."
    }
  ],
  25: [
    {
      prompt: "Long giả định entry2350, stop2338, target2370: gross R là bao nhiêu? / Compute gross reward divided by risk.",
      options: ["12/20=0,60 / 0.60R", "20/12≈1,67 / 1.67R", "20/8=2,50 / 2.50R"],
      correct: 1,
      explanation: "Reward=2370−2350=20, risk=2350−2338=12; gross R≈1,67 trước chi phí. / Gross R excludes costs and does not imply a realized return."
    },
    {
      prompt: "Policy đã khóa yêu cầu gross R≥2; setup 20/12≈1,67R nên xử lý thế nào? / What should a fixed minimum-2R policy do with this setup?",
      options: ["Tăng target sau reveal / Raise target after reveal", "Giảm stop tùy ý để đủ 2R / Arbitrarily tighten stop", "No-trade theo tiêu chí cũ / Reject under the fixed rule"],
      correct: 2,
      explanation: "Setup không đạt ngưỡng; sửa stop/target chỉ để vượt tiêu chí làm mất tính kiểm thử của policy. / Do not retrofit the plan to manufacture a qualifying ratio."
    },
    {
      prompt: "Entry2350, stop2338, target2374 đã được biện minh và khóa trước reveal: gross R bằng bao nhiêu? / Compute the predeclared plan's gross R.",
      options: ["2R / 2R", "1,5R / 1.5R", "3R / 3R"],
      correct: 0,
      explanation: "Reward=24 và risk=12 nên gross R=2; chỉ đạt tiêu chí tỷ lệ, vẫn phải kiểm tra cấu trúc và chi phí. / Passing the ratio filter alone does not validate a wave-5 plan."
    },
    {
      prompt: "Tại wave4 của standard impulse tăng, giá overlap vùng wave1. Nên làm gì trước khi lập wave5 plan? / What if wave4 overlaps wave1 in a standard bullish impulse?",
      options: ["Bỏ overlap vì target đẹp / Ignore overlap", "Dùng RSI để cứu count / Use RSI to rescue it", "Gọi tự động diagonal / Automatically call a diagonal", "Bác standard-impulse count, xét lại bằng chứng / Reject that count and reassess"],
      correct: 3,
      explanation: "Overlap không được bỏ qua trong standard impulse; diagonal là giả thuyết riêng cần kiểm tra, không phải nhãn cứu tự động. / A new label needs its own evidence."
    },
    {
      prompt: "Thấy nhịp3 tăng mạnh rồi chững, có thể coi wave5 chắc chắn vượt đỉnh3 không? / Must wave5 exceed wave3 after a strong third wave?",
      options: ["Có, bất kể cấu trúc / Yes, regardless of structure", "Không; maturity chưa chắc, có truncation/extension / No; maturity and extent remain uncertain", "Có, nếu đúng equality / Yes at equality"],
      correct: 1,
      explanation: "Wave3 maturity cần bằng chứng; wave5 có thể truncation hoặc extension nên target chỉ là kịch bản. / Neither a new extreme nor a fixed wave-5 length is guaranteed."
    },
    {
      prompt: "Stop của wave5 plan bị chạm nhưng structural invalidation chưa bị phá. Báo cáo nào đúng? / The trade stop triggers before structural invalidation; how should this be logged?",
      options: ["Kéo stop ra để giữ lệnh / Widen the stop", "Ghi thắng nếu count sau đó đúng / Mark a win if count later works", "Ghi stop theo policy; đánh giá count riêng / Log the stop and assess structure separately"],
      correct: 2,
      explanation: "Kết quả giao dịch và chất lượng count là hai trục; không dịch stop hoặc sửa lịch sử để giữ dự đoán. / A stopped plan can coexist with a still-viable structural hypothesis."
    }
  ],
  26: [
    {
      prompt: "A giảm 2400→2340, B giả định kết thúc2370; equality C ở đâu? / Compute the signed equality projection for C.",
      options: ["2310 / 2310", "2430 / 2430", "2280 / 2280"],
      correct: 0,
      explanation: "Vector A=2340−2400=−60; đặt tại B:2370−60=2310. / C equality uses A's signed vector from B, not an unsigned upward distance."
    },
    {
      prompt: "Short entry2365, stop2402, target2310: gross R là bao nhiêu? / Compute the short plan's gross R.",
      options: ["37/55≈0,67 / 0.67R", "55/37≈1,49 / 1.49R", "55/5=11 / 11R"],
      correct: 1,
      explanation: "Reward=2365−2310=55, risk=2402−2365=37; gross R≈1,49 trước chi phí. / A neat equality target does not change the reward-to-risk arithmetic."
    },
    {
      prompt: "Đang gọi correction là zigzag nhưng A chỉ thấy ba sóng; cần làm gì? / The proposed zigzag has a three-wave A; what should be reconsidered?",
      options: ["Vẫn chắc 5–3–5 vì có ABC / ABC guarantees 5–3–5", "Dùng equality để xác nhận A / Equality validates A", "Xem flat/complex/unknown, kiểm tra lại A / Reassess alternatives and A's structure"],
      correct: 2,
      explanation: "Zigzag yêu cầu A motive; ba sóng A khiến giả thuyết đó cần xem lại, không tự chứng minh flat. / Question the zigzag without automatically certifying another correction."
    },
    {
      prompt: "Giá vừa lên 2370 trong B, chưa có bằng chứng B xong; equality2310 có xác nhận C đã bắt đầu không? / Does the projection confirm C has begun?",
      options: ["Có, mức tính được là trigger / A computable level is a trigger", "Có, B không được kéo dài / B cannot extend", "Có nếu RSI thấp / Yes with low RSI", "Không; neo B vẫn có điều kiện / No; B's endpoint remains conditional"],
      correct: 3,
      explanation: "Projection là phép đo từ giả định, không phải chứng cứ kết thúc B; correction có thể tiếp tục phức tạp. / A projected level cannot confirm its own placement anchor."
    },
    {
      prompt: "C plan có gross1,49R nhưng policy yêu cầu 2R; equality rất đẹp. Nên làm gì? / Does a neat equality target override the 2R filter?",
      options: ["Không; no-trade theo policy / No; reject the plan", "Có; Fib miễn trừ risk / Fib overrides risk", "Dời target sau kết quả / Move target after outcome"],
      correct: 0,
      explanation: "Confluence hay equality không thay phép tính 55/37 và không miễn điều kiện đã khóa. / Attractive structure cannot make inadequate reward-to-risk pass a fixed filter."
    },
    {
      prompt: "Muốn short C trong bối cảnh Daily đang tăng, cần ghi rõ điều gì? / What must a short-C plan document within a rising Daily context?",
      options: ["C luôn đổi xu hướng Daily / C always reverses Daily", "Parent context, countertrend risk và quy ước stop / Context, countertrend risk and stop policy", "Chỉ nhãn ABC / ABC labels only"],
      correct: 1,
      explanation: "C ở degree nhỏ có thể ngược parent trend; cần phân biệt mốc invalidation với stop theo quy ước và giới hạn kỳ vọng. / A lower-degree C is not automatically a major trend reversal."
    }
  ],
  27: [
    {
      prompt: "Policy A có hai legs budget25 mỗi leg; B một leg budget50. So sánh nào đúng? / Compare their planned cash risk.",
      options: ["A rủi ro gấp đôi vì hai legs / A doubles risk", "B an toàn hơn vì một leg / B is safer solely by leg count", "Cả hai tổng50 nếu sizing đúng / Both total 50 if sized correctly"],
      correct: 2,
      explanation: "Số lệnh không quyết định tổng tiền rủi ro; A cộng 25+25 và B là 50. / Compare aggregate modeled risk rather than counting orders."
    },
    {
      prompt: "Ba setups được áp dụng cả limit và confirmation; tối thiểu có bao nhiêu policy records? / How many records cover both policies across three setups?",
      options: ["6, kể cả unfilled/no-trade / 6, including unfilled or no-trade", "3, chỉ policy thắng / 3, winners only", "2, một dòng mỗi policy / 2, one per policy"],
      correct: 0,
      explanation: "3 setups×2 policies=6 records giúp giữ cùng tập case và nhìn cả missed trades lẫn ca mơ hồ. / Paired records prevent selective comparisons."
    },
    {
      prompt: "Confirmation chỉ khớp 1/3 setup, limit có 3/3; có được chỉ so một lệnh confirmation với winner limit không? / May only selected filled winners be compared?",
      options: ["Có, unfilled không phải dữ liệu / Unfilled cases are irrelevant", "Có nếu confirmation ít lệnh / Yes, fewer trades", "Có nếu bỏ cả losers / Yes, remove losers", "Không; giữ toàn bộ cùng3 setups / No; retain the paired sample"],
      correct: 3,
      explanation: "Unfilled và losers là kết quả policy, không được bỏ để làm đẹp so sánh; cần cùng tiêu chí xử lý mọi case. / Selection after outcomes destroys a fair policy comparison."
    },
    {
      prompt: "Stop dời về entry rồi khớp đúng entry; nếu có commission thì net có nhất thiết bằng0 không? / Is an entry-price exit necessarily net break-even?",
      options: ["Có, vì hai giá bằng nhau / Yes, identical prices", "Không; phí và slippage có thể làm net âm / No; costs can make it negative", "Có, nếu gọi là BE / Yes, the label ensures it"],
      correct: 1,
      explanation: "BE theo giá chỉ triệt tiêu gross price P&L; commission, spread/slippage theo mô hình vẫn phải tính. / The break-even label does not remove execution costs."
    },
    {
      prompt: "Nến OHLC chạm limit nhưng thiếu tick/bid/ask; có nên ghi chắc filled không? / Does an OHLC touch prove the limit was filled?",
      options: ["Có, wick là giá thực thi / Wick equals executable price", "Có nếu nến đóng có lợi / Yes, favorable close", "Không; ghi điều kiện chạm hoặc ambiguous / No; record a touch or ambiguity"],
      correct: 2,
      explanation: "OHLC không đủ xác định spread, thứ tự giá hay tính thực thi của lệnh; thiếu dữ liệu thì không xác nhận fill. / A conditional evaluation is not an execution claim."
    },
    {
      prompt: "Từ “aggressive” trong limit policy có cho phép tăng risk% và chọn BE sau khi biết kết quả không? / May an aggressive policy raise risk and choose BE retrospectively?",
      options: ["Không; giữ budget, khóa BE/expiry trước / No; fix risk and management rules first", "Có, aggressive nghĩa là risk gấp đôi / Yes, double risk", "Có, chọn BE đẹp nhất mỗi case / Yes, best BE per case"],
      correct: 0,
      explanation: "Khác cách vào không đồng nghĩa tăng ngân sách; BE hoặc không BE cùng expiry phải được quyết định trước reveal. / Entry aggressiveness is not permission to change risk or retrofit management."
    }
  ],
  28: [
    {
      prompt: "Muốn audit ví dụ wave3/5/C trong sách mà tránh hindsight, bước đầu là gì? / What is the first step in a hindsight-controlled source audit?",
      options: ["Đọc target trước rồi tìm entry / Read the target first", "Che chart sau cutoff, viết plan rồi reveal / Hide future data and plan before reveal", "Chỉ chọn ví dụ thắng / Select winners only"],
      correct: 1,
      explanation: "Che kết quả giữ quyết định trong phạm vi dữ liệu lúc đó; nếu đã thấy tương lai phải ghi giới hạn của audit. / Future masking reduces hindsight but cannot erase prior exposure."
    },
    {
      prompt: "Có 3 source examples và replay thêm 3 đoạn XAUUSD của mình; cần tách hồ sơ thế nào? / How should these six records be organized?",
      options: ["Gộp thành 6 giao dịch sách được tái tạo / Six recreated book trades", "Chỉ giữ nguồn nào có lãi / Keep profitable sources", "3 source audits và3 XAUUSD replay records riêng / Separate source and independent replay records"],
      correct: 2,
      explanation: "Source audit dẫn trang/hình còn XAUUSD replay là dữ liệu riêng, không phải tái tạo execution trong sách. / Keep provenance explicit rather than conflating unrelated charts."
    },
    {
      prompt: "Ảnh sách cho thấy giá đi entry2350→target2450. Điều gì chưa được chứng minh? / What does a chart's 100-point target move fail to prove?",
      options: ["Fill, spread và expectancy của chiến lược / Fill, spread and strategy expectancy", "Khoảng cách hình học là100 / The geometric distance is 100", "2450 cao hơn2350 / 2450 exceeds 2350"],
      correct: 0,
      explanation: "Khoảng giá có thể đo nhưng ảnh không cho toàn bộ dữ liệu thực thi hay mẫu thống kê. / A visible winner is neither a verified trade nor evidence of positive expectancy."
    },
    {
      prompt: "Ở cutoff10:00 thấy A và B chưa xong; sau14:00 C hoàn tất. Ghi “10:00 đã biết B xong” là gì? / What is backdating B's completion to 10:00?",
      options: ["Quan sát trực tiếp / Direct observation", "Thông số broker / Broker specification", "Đo lường khách quan / Objective measurement", "Hindsight, không phải entry-time evidence / Hindsight, not contemporaneous evidence"],
      correct: 3,
      explanation: "Phân biệt điều thấy lúc cutoff với điều suy ra sau reveal; completion tương lai không được nhập vào plan cũ. / Later knowledge must remain separate from the original evidence."
    },
    {
      prompt: "Bảng audit một hình gốc nên gồm những cột nào? / Which fields belong in a source-case audit?",
      options: ["Chỉ giá target và chữ win / Target and win label", "Trang/hình, điều thấy, giả định, điều ảnh không chứng minh / Source, observations, assumptions, limitations", "Chỉ nhãn tác giả / Author's labels only"],
      correct: 1,
      explanation: "Trích vị trí nguồn giúp đối chiếu; tách observations khỏi assumptions và execution unknowns tránh coi narrative là bằng chứng. / Source traceability does not turn assumptions into facts."
    },
    {
      prompt: "Ba ví dụ được chọn vì đều đi đúng target có thể cho biết win rate tổng thể không? / Can three selected winners establish the overall win rate?",
      options: ["Có, 100% / Yes, 100%", "Có, miễn cùng wave / Yes, same wave type", "Không; mẫu đã chọn theo kết quả / No; outcome-selected sample"],
      correct: 2,
      explanation: "Ví dụ minh họa không đại diện chuỗi case liên tiếp và thiếu losers/unfilled; không suy thống kê chiến lược từ đó. / Selected narratives cannot estimate a strategy's base rates."
    }
  ],
  29: [
    {
      prompt: "Pilot10 case liên tiếp gồm6 có điều kiện vào,2 thiếu evidence,2 no-trade; ledger nên có bao nhiêu dòng? / How many cases should the ledger retain?",
      options: ["10 dòng, ghi lý do từng ca / All 10 with reasons", "6 dòng vì chỉ có lệnh đáng kể / Only six actionable cases", "Chỉ winners / Winners only"],
      correct: 0,
      explanation: "Tiêu chí chọn mẫu đã khóa nên giữ mọi case, kể cả thiếu dữ liệu và không có lệnh. / Sequential sampling must not discard inconvenient outcomes."
    },
    {
      prompt: "Bốn kết quả net R đã hợp lệ là +1,2; −1; +0,8; 0. Mean net R bằng bao nhiêu? / Compute the valid sample's mean net R.",
      options: ["+0,5R / +0.5R", "+1R / +1R", "+0,25R / +0.25R"],
      correct: 2,
      explanation: "Tổng net R=1,2−1+0,8+0=1; chia4 được0,25R. Mẫu bốn ca quá nhỏ để khẳng định edge. / A positive sample mean is not proof of a durable advantage."
    },
    {
      prompt: "10 case chỉ có OHLC, không đủ execution data. Báo cáo nào trung thực? / What can be reported without valid execution data?",
      options: ["Bảng lợi nhuận giả định như đã khớp / Profit table as if filled", "Tỷ lệ tuân thủ cấu trúc và giới hạn dữ liệu / Structural compliance and data limits", "Net R chính xác tới hai số lẻ / Exact net R"],
      correct: 1,
      explanation: "Không thể bịa fill/cost để tạo P&L; chỉ báo các điều kiện kiểm tra được và nêu phần chưa biết. / Measure process evidence rather than inventing execution results."
    },
    {
      prompt: "Sau5 case test thấy thua rồi sửa trigger; 5 case tiếp theo có còn là cùng bài test frozen rules không? / Does a mid-test trigger change preserve the original frozen test?",
      options: ["Có nếu kết quả tốt hơn / Yes if improved", "Có nếu không ghi thay đổi / Yes if unlogged", "Có vì tổng vẫn10 / Yes, still ten cases", "Không; lưu phiên bản và test mới trên dữ liệu chưa dùng / No; version and retest on unseen data"],
      correct: 3,
      explanation: "Điều chỉnh từ test làm rò rỉ thông tin vào policy; phải tách train/test và không gộp như một thử nghiệm bất biến. / Adaptive tuning changes the experiment."
    },
    {
      prompt: "Plan hợp quy tắc nhưng lỗ ngẫu nhiên; plan khác vi phạm origin nhưng thắng. Sổ lỗi phân loại thế nào? / How should process and outcome be distinguished?",
      options: ["Ca thắng vẫn có lỗi origin; ca lỗ chưa chắc lỗi phân tích / A win may contain an error; a loss may not", "Cả hai đều đúng nếu tổng có lãi / Both valid if total profit positive", "Chỉ ca lỗ là lỗi / Only the loss is an error"],
      correct: 0,
      explanation: "Lỗi origin thuộc cấu trúc, không được xóa bằng P&L; outcome xấu chưa đủ chứng minh quy trình sai. / Audit decision quality separately from random outcomes."
    },
    {
      prompt: "Ledger phát hiện3 lỗi gốc: overlap bị bỏ qua, trộn degree, dùng nến tương lai. Biện pháp nào trực tiếp nhất? / Which prevention checks target these three root errors?",
      options: ["Thêm nhiều mức Fib / Add more Fib levels", "Checklist hard rules, bảng degree, khóa cutoff / Rule checklist, degree map, locked cutoff", "Tăng size để bù lỗi / Increase size to compensate"],
      correct: 1,
      explanation: "Mỗi biện pháp chặn một nguyên nhân cụ thể; ghi lỗi gốc và kiểm tra trước reveal có ích hơn tối ưu outcome sau đó. / Prevent recurrence with targeted process controls."
    }
  ],
  // Six-question practice checkpoint; the roadmap's 20-question capstone remains separate.
  30: [
    {
      prompt: "Bài thi đạt84/100 nhưng bịa broker specs để tính size. Có đạt không? / Does 84/100 pass when broker specifications were fabricated?",
      options: ["Có vì vượt80 / Yes, above 80", "Có nếu trade thắng / Yes if profitable", "Không; còn critical error phải sửa / No; resolve the critical error"],
      correct: 2,
      explanation: "Điều kiện đạt là ít nhất80/100 và không có critical error; điểm số không miễn việc bịa specs/fills. / Passing requires both the score threshold and clean critical-error checks."
    },
    {
      prompt: "Điểm các phần là32/40,20/25,12/15,8/10,8/10 và không critical error. Kết luận nào đúng? / Sum the scores and apply the capstone gate.",
      options: ["80/100; đạt mục tiêu học tập / 80/100; learning goal met", "78/100; không đạt / 78/100; fail", "80/100; chứng nhận chuyên nghiệp / 80/100; professional certification"],
      correct: 0,
      explanation: "32+20+12+8+8=80, vừa ngưỡng; kết luận chỉ là đạt mục tiêu học tập, không chứng nhận năng lực kiếm lời. / The threshold is met without implying professional status."
    },
    {
      prompt: "Daily/H4/H1 study nên tổ chức thế nào để tránh look-ahead? / How should the multitimeframe capstone avoid future leakage?",
      options: ["Mỗi khung chọn tương lai đẹp nhất / Pick each timeframe's best future", "Dùng H1 sau cutoff để cứu H4 / Use future H1 to rescue H4", "Chỉ cần cùng symbol / Same symbol is enough", "Chọn trước cutoff, chỉ dùng dữ liệu sẵn có từng khung / Lock cutoff and available data"],
      correct: 3,
      explanation: "Ba khung phải cùng ranh giới thông tin; nến khung lớn chưa đóng không được coi là đã có OHLC hoàn chỉnh. / Align available information, including higher-timeframe bar completion."
    },
    {
      prompt: "Sau reveal count gốc sai hướng, count sửa tốt hơn. Hồ sơ capstone cần giữ gì? / What should be retained when a corrected count replaces the original?",
      options: ["Chỉ count sửa / Corrected count only", "Bản trước/sau, endpoints, invalidation và lý do sửa / Both versions and the audit trail", "Xóa bản gốc để tránh nhầm / Delete the original"],
      correct: 1,
      explanation: "Bảo toàn bản gốc cho phép đánh giá reasoning tại cutoff và học từ sai; sửa có giải thích không phải viết lại lịch sử. / A transparent revision preserves the original decision evidence."
    },
    {
      prompt: "Tại cutoff chưa đủ evidence để chọn primary và size; bài cuối có được nộp no-trade không? / May the capstone conclude with no trade?",
      options: ["Không, bắt buộc có lệnh / No; a trade is required", "Có nhưng không cần lý do / Yes, without reasons", "Có; nêu thiếu evidence, risk limits và điều kiện xét lại / Yes; document reasons and review conditions"],
      correct: 2,
      explanation: "Mục tiêu là phân tích kiểm thử được và kỷ luật rủi ro, không ép lệnh; no-trade có lập luận là kết quả hợp lệ. / A reasoned abstention can demonstrate the intended skills."
    },
    {
      prompt: "Checkpoint 6 câu này không thay bài capstone 20 câu; nếu capstone đạt76/100 sau30 ngày thì làm gì? / This six-question practice checkpoint does not replace the 20-question capstone; what follows a 76/100 capstone result?",
      options: ["Học lại nhóm yếu và kiểm tra lại; không mặc định chuyển tiền thật / Remediate and reassess", "Chuyển tiền thật vì đủ ngày / Go live because time elapsed", "Dùng P&L cộng thêm điểm / Add points for profit"],
      correct: 0,
      explanation: "Lộ trình không hứa chuyên gia sau30 ngày; cần sửa kỹ năng yếu, giữ review và đạt chuẩn thay vì lấy lịch hay P&L thay điểm. / Readiness is demonstrated by process, not elapsed time or profits."
    }
  ]
};
