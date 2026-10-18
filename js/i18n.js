/* Song ngữ VI/EN. Khoá trùng với thuộc tính data-i18n trong index.html. */
(function () {
  const DICT = {
    vi: {
      title: "Năng lượng cập tàu & đệm tàu", subtitle: "PIANC WG 211 (2024) · OCDI 2020 · BS 6349-4:2026 (chờ cập nhật)",
      tabShip: "Tàu", tabCond: "Điều kiện cập", tabEnergy: "Năng lượng", tabFender: "Đệm tàu", tabReport: "Báo cáo",
      shipType: "Loại tàu", shipClass: "Cấp tàu", shipData: "Dữ liệu tàu", fromList: "Chọn từ danh sách", fromDwt: "Tính từ DWT",
      selectShip: "Chọn tàu", dwt: "Trọng tải DWT (t)", estimate: "Ước lượng kích thước", loadCond: "Trạng thái tải khi cập",
      full: "Đầy tải", ballast: "Dằn (ballast)", loadHintFull: "Dùng lượng giãn nước và mớn nước đầy tải của tàu.",
      loadHintBallast: "Mớn nước dằn lấy từ mooringloads. Lượng giãn nước khi dằn được ước lượng M ≈ ρ·C_b·L_BP·B·T_dằn (C_b đầy tải) — nên thay bằng số liệu tàu.",
      dims: "Kích thước tàu", dispM: "Lượng giãn nước M (t)", beam: "Bề rộng B (m)", draft: "Mớn nước T (m)", cbSource: "C_b nguồn",
      rho: "ρ nước (t/m³)", cbCalc: "C_b = M/(ρ·L·B·T)", dimsHint: "Ô viền cam là giá trị đã sửa tay; báo cáo sẽ ghi lại.",
      next: "Tiếp: điều kiện cập →", berth: "Bến và cách cập", mode: "Cách cập", modeAlong: "Cập dọc bến",
      modeBow: "Cập mũi vào (end, bow first)", modeSternD: "Cập đuôi vào (tàu thiết kế cập đuôi)", modeStern: "Cập đuôi vào (tàu thường)",
      depth: "Độ sâu nước tại bến (m)", pitch: "Khoảng cách đệm (m)",
      depthHint: "Độ sâu dùng để tính khe nước dưới đáy U_c = độ sâu − T (PIANC Hình 5.7).",
      standards: "Tiêu chuẩn tính", pending: "chờ bản tiêu chuẩn", nav: "Điều kiện hàng hải", favourable: "Thuận lợi",
      moderate: "Trung bình", unfavourable: "Bất lợi", cc: "Lớp hậu quả", cov: "Biến động lượng giãn nước CoV_M",
      covLow: "Thấp (< 15 %)", covMod: "Trung bình (15–50 %)", covHigh: "Cao (≥ 50 %)", contact: "Số đệm tiếp xúc",
      single: "Một đệm", multiple: "Nhiều đệm", nBerth: "Số lần cập/năm", manoeuvre: "Cách tiếp cận", parallel: "Song song",
      angular: "Nghiêng góc", tugs: "Có tàu lai", thrusters: "Có chân vịt mũi", pilot: "Có hoa tiêu",
      monitored: "Có hệ thống đo vận tốc cập", overrides: "Nhập tay (để trống = theo bảng)", vManual: "V_c (m/s)", aManual: "α_c (°)",
      xF: "Điểm va x_F/L_BP", ocdiV: "V_b (m/s)", ocdiTheta: "Góc cập θ (°)", alphaPs: "Thân song song α (/L_pp)", auto: "Tự động",
      ocdiHint: "OCDI không cho bảng vận tốc: tàu lớn có lai dắt thường 0,10–0,15 m/s; tàu nhỏ tự cập có thể vượt 0,30 m/s. Để trống sẽ dùng V của PIANC.",
      calcEnergy: "Tính năng lượng cập tàu",
      energyEmpty: "Chưa có kết quả — nhập dữ liệu ở bước 1–2 rồi bấm “Tính năng lượng cập tàu”.",
      showSteps: "Các bước tính", sweepTitle: "Độ nhạy theo vận tốc cập", sweep: "Quét V ± 40 %", toFender: "Tiếp: chọn đệm →",
      fCond: "Điều kiện chọn đệm", fStd: "Kiểm tra theo", fE: "Năng lượng cần hấp thụ (kNm)", fV: "Vận tốc cập (m/s)",
      fAng: "Góc nén đệm (°)", fTh: "Nhiệt độ cao (°C)", fTl: "Nhiệt độ thấp (°C)", fMult: "C_mult (nhiều đệm)",
      fRallow: "R cho phép kết cấu (kN)", fPhull: "Áp lực vỏ tàu cho phép (kN/m²)", fPanel: "Diện tích tấm chắn (m²)",
      fFilter: "Hãng và loại đệm", cone: "Đệm nón (cone)", cell: "Đệm trụ (cell)", select: "Chọn đệm",
      custom: "Đệm tự nhập (đường cong riêng)", cName: "Tên", cRated: "Độ nén định mức (%)", cTol: "Dung sai (%)",
      cCurve: "Đường cong: mỗi dòng “δ%, E%, R%”", checkCustom: "Kiểm tra đệm tự nhập", candidates: "Phương án đạt",
      hFender: "Đệm", hGrade: "Cấp", hUtil: "Tỉ lệ dùng", noCand: "Bấm “Chọn đệm”.", compare: "So sánh đệm đã đánh dấu",
      factors: "Hệ số hiệu chỉnh", pitchTitle: "Khoảng cách đệm tối đa (PIANC 6.4.3)", loaMin: "LOA tàu nhỏ nhất (m)",
      panelT: "Dày tấm chắn (m)", recalc: "Tính lại", compareTitle: "So sánh đệm", project: "Tên dự án / bến",
      makeReport: "Lập báo cáo", print: "In / PDF", saveInput: "Lưu đầu vào (JSON)", reportEmpty: "Chưa có báo cáo.",
      footNote: "Số liệu tiêu chuẩn và catalogue trích từ tài liệu người dùng cung cấp, chờ kỹ sư đối chiếu. Dùng cho thiết kế sơ bộ.",
      // động
      apiOk: "API sẵn sàng", apiWait: "Đang kết nối…", apiErr: "Không kết nối được máy chủ", wakeRender: "Đang tính trên Render (lần đầu có thể mất 30–60 giây)...",
      busy: "Backend đang tính...", needShip: "Vui lòng nạp hoặc nhập đủ kích thước tàu.", needEnergy: "Hãy tính năng lượng ở bước 3 trước.",
      loaded: "Đã nạp kích thước tàu", estimated: "Kích thước ước lượng từ DWT (hồi quy mooringloads)",
      srcLive: "Nguồn: mooringloads (trực tiếp)", srcCache: "Nguồn: mooringloads (bộ nhớ đệm)", srcSnapshot: "Nguồn: bản sao lưu cục bộ — mooringloads không phản hồi",
      shipsN: "{n} tàu", noShips: "(không có tàu)", warnings: "Lưu ý", ratio: "Tỉ lệ PIANC/OCDI",
      kEkc: "E_k,c PIANC", kEkd: "E_k,d PIANC (thiết kế)", kEf: "E_f OCDI", pass: "Đạt", fail: "Không đạt",
      evaluated: "{p}/{n} tổ hợp đạt", hullDefault: "Áp lực vỏ tàu mặc định theo PIANC Bảng 6-6: {p} kN/m² ({t}).",
      ocdiHull: "OCDI khuyến nghị 200–400 kN/m².", unverified: "Số liệu chưa đối chiếu", selectedInfo: "Đã chọn {n} đệm để so sánh",
      reportReady: "Đã lập báo cáo", customBad: "Đường cong không hợp lệ: cần ít nhất 3 dòng “δ, E, R”.",
    },
    en: {
      title: "Berthing energy & fenders", subtitle: "PIANC WG 211 (2024) · OCDI 2020 · BS 6349-4:2026 (pending)",
      tabShip: "Ship", tabCond: "Berthing conditions", tabEnergy: "Energy", tabFender: "Fenders", tabReport: "Report",
      shipType: "Ship type", shipClass: "Ship class", shipData: "Ship data", fromList: "Select from list", fromDwt: "From DWT",
      selectShip: "Select ship", dwt: "Deadweight DWT (t)", estimate: "Estimate dimensions", loadCond: "Loading condition at berthing",
      full: "Fully loaded", ballast: "Ballast", loadHintFull: "Uses fully loaded displacement and draught.",
      loadHintBallast: "Ballast draught from mooringloads. Ballast displacement estimated as M ≈ ρ·C_b·L_BP·B·T_ballast (full-load C_b) — replace with vessel data.",
      dims: "Ship dimensions", dispM: "Displacement M (t)", beam: "Beam B (m)", draft: "Draught T (m)", cbSource: "Source C_b",
      rho: "Water density ρ (t/m³)", cbCalc: "C_b = M/(ρ·L·B·T)", dimsHint: "Orange-bordered fields were edited by hand; the report records them.",
      next: "Next: berthing conditions →", berth: "Berth and approach", mode: "Berthing mode", modeAlong: "Alongside",
      modeBow: "End berthing, bow first", modeSternD: "End berthing, stern first (designed)", modeStern: "End berthing, stern first (not designed)",
      depth: "Water depth at berth (m)", pitch: "Fender pitch (m)",
      depthHint: "Depth gives the under keel clearance U_c = depth − T (PIANC Figure 5.7).",
      standards: "Standards", pending: "standard not yet available", nav: "Navigation condition", favourable: "Favourable",
      moderate: "Moderate", unfavourable: "Unfavourable", cc: "Consequence class", cov: "Displacement variation CoV_M",
      covLow: "Low (< 15 %)", covMod: "Moderate (15–50 %)", covHigh: "High (≥ 50 %)", contact: "Fender contact",
      single: "Single", multiple: "Multiple", nBerth: "Berthings per year", manoeuvre: "Approach", parallel: "Parallel",
      angular: "Angular", tugs: "Tugs", thrusters: "Bow thrusters", pilot: "Pilot assisted",
      monitored: "Berthing velocity monitoring", overrides: "Manual values (blank = from tables)", vManual: "V_c (m/s)", aManual: "α_c (°)",
      xF: "Impact point x_F/L_BP", ocdiV: "V_b (m/s)", ocdiTheta: "Berthing angle θ (°)", alphaPs: "Parallel side α (/L_pp)", auto: "Auto",
      ocdiHint: "OCDI gives no velocity table: tug-assisted large ships typically 0.10–0.15 m/s; small ships without tugs may exceed 0.30 m/s. Blank uses the PIANC velocity.",
      calcEnergy: "Calculate berthing energy",
      energyEmpty: "No result yet — enter data in steps 1–2 and press “Calculate berthing energy”.",
      showSteps: "Calculation steps", sweepTitle: "Sensitivity to berthing velocity", sweep: "Sweep V ± 40 %", toFender: "Next: select fenders →",
      fCond: "Fender selection criteria", fStd: "Check to", fE: "Energy to absorb (kNm)", fV: "Berthing velocity (m/s)",
      fAng: "Compression angle (°)", fTh: "High temperature (°C)", fTl: "Low temperature (°C)", fMult: "C_mult (multiple contact)",
      fRallow: "Allowable structure reaction (kN)", fPhull: "Allowable hull pressure (kN/m²)", fPanel: "Panel area (m²)",
      fFilter: "Manufacturers and types", cone: "Cone fenders", cell: "Cell fenders", select: "Select fenders",
      custom: "Custom fender (own curve)", cName: "Name", cRated: "Rated deflection (%)", cTol: "Tolerance (%)",
      cCurve: "Curve: one line per “δ%, E%, R%”", checkCustom: "Check custom fender", candidates: "Passing options",
      hFender: "Fender", hGrade: "Grade", hUtil: "Utilisation", noCand: "Press “Select fenders”.", compare: "Compare ticked fenders",
      factors: "Correction factors", pitchTitle: "Maximum fender pitch (PIANC 6.4.3)", loaMin: "Smallest vessel LOA (m)",
      panelT: "Panel thickness (m)", recalc: "Recalculate", compareTitle: "Fender comparison", project: "Project / berth",
      makeReport: "Build report", print: "Print / PDF", saveInput: "Save input (JSON)", reportEmpty: "No report yet.",
      footNote: "Standard and catalogue data extracted from user-supplied documents, pending engineering review. For preliminary design.",
      apiOk: "API ready", apiWait: "Connecting…", apiErr: "Cannot reach the server", wakeRender: "Computing on Render (first call may take 30–60 s)...",
      busy: "Backend computing...", needShip: "Please load or enter all ship dimensions.", needEnergy: "Calculate the energy in step 3 first.",
      loaded: "Ship dimensions loaded", estimated: "Dimensions estimated from DWT (mooringloads regression)",
      srcLive: "Source: mooringloads (live)", srcCache: "Source: mooringloads (cached)", srcSnapshot: "Source: local snapshot — mooringloads not responding",
      shipsN: "{n} ships", noShips: "(no ships)", warnings: "Notes", ratio: "Ratio PIANC/OCDI",
      kEkc: "E_k,c PIANC", kEkd: "E_k,d PIANC (design)", kEf: "E_f OCDI", pass: "Pass", fail: "Fail",
      evaluated: "{p}/{n} combinations pass", hullDefault: "Default hull pressure from PIANC Table 6-6: {p} kN/m² ({t}).",
      ocdiHull: "OCDI recommends 200–400 kN/m².", unverified: "Data not yet verified", selectedInfo: "{n} fenders ticked",
      reportReady: "Report built", customBad: "Invalid curve: at least 3 lines “δ, E, R” required.",
    },
  };
  let lang = "vi";
  try { lang = localStorage.getItem("berthing-lang") || "vi"; } catch (e) {}

  function t(key, vars) {
    let s = (DICT[lang] && DICT[lang][key]) || DICT.vi[key] || key;
    if (vars) for (const k in vars) s = s.replace("{" + k + "}", vars[k]);
    return s;
  }
  // Chuỗi trong từ điển là hằng số của app; thoát HTML rồi đổi "C_b" thành C<sub>b</sub>.
  function subs(s) {
    const esc = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return esc.replace(/([A-Za-zαγρ])_([A-Za-z0-9]+(?:,[a-z]+)?)/g, "$1<sub>$2</sub>");
  }
  function apply() {
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const v = (DICT[lang] || {})[el.dataset.i18n];
      if (v) el.innerHTML = subs(v);
    });
    document.querySelectorAll("[data-lang]").forEach((b) => b.classList.toggle("on", b.dataset.lang === lang));
  }
  function setLang(l) {
    lang = DICT[l] ? l : "vi";
    try { localStorage.setItem("berthing-lang", lang); } catch (e) {}
    apply();
    document.dispatchEvent(new CustomEvent("langchange"));
  }
  window.I18N = { t, apply, setLang, subs, get lang() { return lang; } };
})();
