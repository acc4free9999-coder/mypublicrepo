# Hệ thống chấm điểm Trendline Pullback kết hợp đa phương pháp

> Mục tiêu: chuẩn hóa cách đánh giá setup Trendline Pullback bằng
> checklist 100 điểm, giảm quyết định cảm tính và tạo dữ liệu để kiểm
> thử chiến lược. Điểm cao **không đảm bảo winrate cao** và không thay
> thế quản trị rủi ro.

## Mục lục

1.  [Tổng quan hệ thống](#tổng-quan-hệ-thống)
2.  [Bảng chấm điểm 100 điểm](#bảng-chấm-điểm-100-điểm)
3.  [Hướng dẫn chấm từng tiêu chí](#hướng-dẫn-chấm-từng-tiêu-chí)
4.  [Ngưỡng phân loại setup](#ngưỡng-phân-loại-setup)
5.  [Bộ lọc bắt buộc](#bộ-lọc-bắt-buộc)
6.  [Quy trình phân tích](#quy-trình-phân-tích)
7.  [Nhật ký và kiểm thử](#nhật-ký-và-kiểm-thử)
8.  [Công thức đánh giá hiệu quả](#công-thức-đánh-giá-hiệu-quả)
9.  [Nguyên tắc quản trị rủi ro](#nguyên-tắc-quản-trị-rủi-ro)

------------------------------------------------------------------------

## Tổng quan hệ thống

Hệ thống kết hợp các nhóm phương pháp:

-   **Market Structure:** xác định xu hướng và cấu trúc HH--HL / LL--LH.
-   **Trendline:** đánh giá chất lượng đường xu hướng và phản ứng khi
    giá quay lại.
-   **Higher Timeframe (HTF):** xác định thiên hướng từ khung thời gian
    lớn.
-   **Supply & Demand:** đánh giá vùng cung/cầu có ý nghĩa.
-   **ICT/SMC:** quan sát thanh khoản, liquidity sweep, displacement và
    cấu trúc nhỏ.
-   **Price Action:** chờ tín hiệu xác nhận tại vùng pullback.
-   **RSI/MACD:** tham khảo động lượng; không dùng như tín hiệu độc lập.
-   **Volume Profile:** tham khảo HVN, LVN, vùng giá trị; lưu ý volume
    Forex OTC có thể không đại diện toàn thị trường.
-   **Elliott Wave:** dùng như kịch bản bổ trợ, không ép đếm sóng để hợp
    thức hóa lệnh.
-   **Risk/Reward & ATR:** kiểm tra điểm vô hiệu hóa, biến động và mục
    tiêu lợi nhuận.

### Khung thời gian tham khảo

Ví dụ với giao dịch trên M15:

-   **H4:** bối cảnh và xu hướng lớn.
-   **H1:** vùng giao dịch và cấu trúc trung gian.
-   **M15:** chờ xác nhận và tìm điểm vào.

Đây chỉ là cấu hình mẫu cần kiểm thử, không phải cấu hình tối ưu cho mọi
thị trường.

## Bảng chấm điểm 100 điểm

    \# Tiêu chí                      Điểm tối đa
  ---- --------------------------- -------------
     1 Market Structure                       15
     2 Chất lượng Trendline                   15
     3 Higher Timeframe Bias                  10
     4 Supply & Demand                        10
     5 ICT/SMC Liquidity                      10
     6 Price Action Confirmation              15
     7 RSI/MACD                                5
     8 Volume Profile                          5
     9 Elliott Wave                            5
    10 Risk/Reward & ATR                      10
       **Tổng**                          **100**

> **Tránh tính trùng bằng chứng:** nếu cùng một tín hiệu được dùng cho
> nhiều nhóm, không cộng tối đa cho tất cả các nhóm chỉ vì một tín hiệu
> đó. Chấm điểm dựa trên bằng chứng độc lập, có thể mô tả và kiểm tra
> lại.

## Hướng dẫn chấm từng tiêu chí

### 1. Market Structure --- tối đa 15 điểm

  -----------------------------------------------------------------------
                                      Điểm Tiêu chuẩn tham khảo
  ---------------------------------------- ------------------------------
                                      0--3 Sideway hoặc cấu trúc không rõ

                                      4--7 Có xu hướng nhưng HH--HL /
                                           LL--LH chưa ổn định

                                     8--12 Cấu trúc xu hướng rõ; các nhịp
                                           hồi được giữ vững

                                    13--15 Xu hướng rõ, BOS thuận hướng
                                           và chưa có CHoCH ngược chiều
                                           đáng tin cậy
  -----------------------------------------------------------------------

Ví dụ Buy: giá tạo Higher High (HH), hồi về Higher Low (HL), sau đó tiếp
tục phá đỉnh. Nếu đáy HL quan trọng bị phá và có dấu hiệu chuyển cấu
trúc, không tiếp tục Buy chỉ vì trendline vẫn còn.

### 2. Chất lượng Trendline --- tối đa 15 điểm

  Yếu tố                                                        Điểm tối đa
  ----------------------------------------------------------- -------------
  Có ít nhất 3 điểm xoay phù hợp để xác định đường xu hướng               4
  Các lần chạm tạo phản ứng giá rõ ràng                                   4
  Đường chưa bị xuyên phá đáng kể                                         3
  Độ dốc hợp lý, không quá dựng đứng                                      2
  Hợp lưu với vùng giá quan trọng                                         2
  **Tổng**                                                           **15**

Số lần chạm không phải yếu tố duy nhất. Hai lần chạm rõ ràng trong cấu
trúc tốt có thể đáng chú ý hơn nhiều lần chạm lộn xộn.

### 3. Higher Timeframe Bias --- tối đa 10 điểm

     Điểm Tiêu chuẩn tham khảo
  ------- --------------------------------------------------
     0--2 Khung lớn đi ngược hướng giao dịch
     3--5 Khung lớn chưa rõ
     6--8 Cùng hướng nhưng chưa có xác nhận mạnh
    9--10 Cùng hướng, cấu trúc rõ và vùng pullback phù hợp

Không tự động giao dịch theo khung lớn nếu điểm vào, điểm vô hiệu hóa
hoặc tỷ lệ R:R không hợp lý.

### 4. Supply & Demand --- tối đa 10 điểm

  Yếu tố                                   Điểm tối đa
  -------------------------------------- -------------
  Pullback chạm vùng cung/cầu có cơ sở               4
  Vùng từng tạo chuyển động giá mạnh                 3
  Vùng chưa bị kiểm tra quá nhiều lần                2
  Hợp lưu với trendline hoặc cấu trúc                1
  **Tổng**                                      **10**

Một vùng demand từng tạo nhịp tăng phá đỉnh, kết hợp trendline tăng,
đáng quan sát hơn việc giá chỉ chạm một đường xu hướng đơn lẻ.

### 5. ICT/SMC Liquidity --- tối đa 10 điểm

  Yếu tố                                                        Điểm tối đa
  ----------------------------------------------------------- -------------
  Có thanh khoản dễ nhận diện dưới đáy / trên đỉnh gần nhất               2
  Có sweep và giá đóng trở lại vùng quan trọng                            3
  Có displacement theo hướng dự kiến                                      3
  Có xác nhận cấu trúc nhỏ phù hợp                                        2
  **Tổng**                                                           **10**

Liquidity sweep không tự động đồng nghĩa với đảo chiều. Cần đánh giá
phản ứng và cấu trúc sau cú quét.

### 6. Price Action Confirmation --- tối đa 15 điểm

  Yếu tố                                           Điểm tối đa
  ---------------------------------------------- -------------
  Nến từ chối giá rõ tại vùng pullback                       4
  Nến xác nhận có thân và lực đóng cửa tốt                   4
  Phá cấu trúc nhỏ theo hướng giao dịch                      4
  Điểm vào và vị trí vô hiệu hóa setup rõ ràng               3
  **Tổng**                                              **15**

Không vào chỉ vì giá vừa chạm trendline. Chờ điều kiện xác nhận đã được
định nghĩa trước, đồng thời tránh thay đổi tiêu chuẩn giữa chừng.

### 7. RSI/MACD --- tối đa 5 điểm

-   Động lượng phù hợp hướng giao dịch: điểm cao hơn.
-   Phân kỳ chỉ là thông tin bổ trợ/cảnh báo, không phải tín hiệu độc
    lập.
-   Nếu không có tín hiệu rõ, chấm thấp hoặc 0; không cần cố dùng chỉ
    báo trong mọi setup.

### 8. Volume Profile --- tối đa 5 điểm

Đánh giá vị trí giá so với các vùng có ý nghĩa như HVN, LVN hoặc cạnh
vùng giá trị. Dữ liệu volume trên Forex OTC có thể chỉ phản ánh nguồn dữ
liệu của nhà cung cấp, không phải toàn bộ thị trường.

### 9. Elliott Wave --- tối đa 5 điểm

Chấm điểm khi kịch bản sóng phù hợp cấu trúc và quy tắc sóng. Nếu có
nhiều cách đếm hợp lý hoặc kịch bản chưa rõ, chấm thấp. Không ép cách
đếm để củng cố thiên kiến vào lệnh.

### 10. Risk/Reward & ATR --- tối đa 10 điểm

Đánh giá:

-   Stop Loss đặt tại điểm vô hiệu hóa hợp lý của setup.
-   Có xét đến biến động thị trường và ATR; tránh đặt SL chỉ theo một số
    pip cố định bất kể điều kiện.
-   Mục tiêu còn đủ xa so với rủi ro, sau khi cân nhắc spread, phí và
    trượt giá.
-   R:R tối thiểu phải được xác định trước bằng kết quả kiểm thử, không
    chọn tùy ý sau khi thấy biểu đồ.

## Ngưỡng phân loại setup

Các ngưỡng sau là **mốc ban đầu để thử nghiệm**, chưa phải bằng chứng
thống kê về winrate.

  ------------------------------------------------------------------------
                     Tổng điểm Phân loại             Hành động tham khảo
  ---------------------------- --------------------- ---------------------
                         0--59 Yếu                   Không ưu tiên; tiếp
                                                     tục quan sát

                        60--74 Trung bình            Ghi nhật ký, xem yếu
                                                     tố còn thiếu

                        75--84 Tốt                   Cân nhắc nếu bộ lọc
                                                     bắt buộc đều đạt

                       85--100 Chất lượng cao theo   Vẫn phải đạt bộ lọc;
                               hệ thống              không tăng lot chỉ vì
                                                     điểm cao
  ------------------------------------------------------------------------

## Bộ lọc bắt buộc

Bất kể tổng điểm, **không giao dịch** nếu có một trong các trường hợp:

-   [ ] Không xác định được điểm vô hiệu hóa setup để đặt Stop Loss hợp
    lý.
-   [ ] Chưa có tín hiệu xác nhận theo quy tắc đã định nghĩa.
-   [ ] R:R thấp hơn mức tối thiểu đã kiểm thử.
-   [ ] Đã chạm giới hạn thua lỗ trong ngày hoặc vi phạm kế hoạch rủi
    ro.
-   [ ] Có tin tức/điều kiện bất thường mà chiến lược chưa được kiểm
    thử.
-   [ ] Đang vào lệnh do FOMO, muốn gỡ lỗ hoặc không giữ được kỷ luật.

Bộ lọc là điều kiện loại trừ, không phải điểm cộng. Một setup 90/100 vẫn
bị loại nếu vi phạm bộ lọc.

## Quy trình phân tích

1.  **Xác định bối cảnh:** đánh dấu xu hướng, cấu trúc và vùng quan
    trọng trên khung lớn.
2.  **Vẽ trendline:** chọn các điểm xoay phù hợp; ghi rõ điều gì làm
    đường xu hướng mất hiệu lực.
3.  **Xác định vùng pullback:** xem xét Supply & Demand và các vùng giá
    liên quan.
4.  **Lập kịch bản:** ghi rõ điều kiện xác nhận Buy/Sell và điều kiện
    hủy kịch bản.
5.  **Chờ xác nhận:** quan sát Price Action, liquidity sweep hoặc phá
    cấu trúc nhỏ theo bộ quy tắc.
6.  **Chấm điểm:** chấm từng nhóm theo bằng chứng quan sát được; tránh
    tính trùng.
7.  **Kiểm tra bộ lọc:** tất cả điều kiện bắt buộc phải đạt.
8.  **Tính rủi ro:** xác định SL, mục tiêu, R:R và khối lượng dựa trên
    mức rủi ro cho phép.
9.  **Ghi nhật ký:** lưu ảnh trước lệnh và sau lệnh, điểm số, kết quả
    theo R và lý do vào/không vào.
10. **Đánh giá định kỳ:** phân tích hiệu quả theo nhóm điểm và điều kiện
    thị trường.

## Nhật ký và kiểm thử

Nên lưu các trường sau cho mỗi setup, kể cả setup không vào lệnh:

  Trường                 Nội dung
  ---------------------- --------------------------------------
  Ngày/giờ               Thời điểm setup xuất hiện
  Sản phẩm               XAUUSD, EURUSD, v.v.
  Phiên giao dịch        Á, Âu, Mỹ hoặc phiên phù hợp
  Điều kiện thị trường   Trend, range, biến động cao, tin tức
  Khung thời gian        HTF / khung vùng / khung vào
  Hướng                  Buy hoặc Sell
  Điểm từng tiêu chí     10 nhóm, tổng điểm
  Bộ lọc                 Đạt / không đạt và lý do
  Entry / SL / TP        Giá dự kiến và giá thực tế
  Kết quả                Win / loss / hòa; lợi nhuận theo R
  Chi phí                Spread, commission, slippage nếu có
  Ảnh biểu đồ            Trước lệnh và sau lệnh
  Ghi chú tâm lý         FOMO, bình tĩnh, revenge trade, v.v.

Hãy ghi nhận cả setup đạt điểm nhưng thua và setup bị loại. Nếu chỉ lưu
các lệnh thắng, dữ liệu sẽ bị thiên lệch.

## Công thức đánh giá hiệu quả

Tính kỳ vọng lợi nhuận theo đơn vị R:

\[ E = P_w `\times `{=tex}`\overline{R}`{=tex}*{win} - P_l
`\times `{=tex}`\overline{R}`{=tex}*{loss} \]

Trong đó:

-   (P_w): tỷ lệ thắng.
-   (P_l): tỷ lệ thua.
-   (`\overline{R}`{=tex}\_{win}): lợi nhuận trung bình của lệnh thắng,
    tính theo R.
-   (`\overline{R}`{=tex}\_{loss}): độ lớn trung bình của khoản lỗ, tính
    theo R.

Nên tính sau chi phí giao dịch khi dữ liệu cho phép. So sánh winrate,
expectancy, drawdown và số lượng setup giữa các nhóm điểm. Dùng dữ liệu
ngoài mẫu hoặc giai đoạn khác để giảm nguy cơ tối ưu quá mức trên dữ
liệu cũ.

## Nguyên tắc quản trị rủi ro

-   Không tăng khối lượng chỉ vì setup có điểm cao.
-   Xác định mức rủi ro trước khi vào lệnh và tuân thủ giới hạn ngày.
-   Không dời Stop Loss xa hơn để tránh nhận lỗ; không thêm vị thế chỉ
    để gỡ lỗ nếu điều đó không thuộc một kế hoạch đã kiểm thử.
-   Điểm số là công cụ chuẩn hóa quyết định, không phải dự báo chắc
    chắn.
-   Thử nghiệm trên dữ liệu lịch sử và tài khoản demo trước khi cân nhắc
    giao dịch bằng tiền thật.

------------------------------------------------------------------------

## Checklist nhanh trước khi vào lệnh

-   [ ] Tôi đã xác định điều kiện thị trường.
-   [ ] Trendline và cấu trúc có cơ sở rõ ràng.
-   [ ] Pullback nằm tại vùng có ý nghĩa.
-   [ ] Tôi đã chờ tín hiệu xác nhận, không vào chỉ vì giá chạm đường.
-   [ ] Điểm số được chấm theo bằng chứng, không tính trùng.
-   [ ] Tất cả bộ lọc bắt buộc đều đạt.
-   [ ] SL, TP, R:R và khối lượng đã được tính trước.
-   [ ] Tôi chấp nhận khoản lỗ theo kế hoạch và không có ý định gỡ lỗ.

**Ghi nhớ:** Mục tiêu của hệ thống không phải tìm setup trông đẹp nhất,
mà là tìm một quy trình có thể lặp lại, đo lường và kiểm chứng bằng dữ
liệu.
