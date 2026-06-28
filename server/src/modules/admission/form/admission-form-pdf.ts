// @ts-nocheck
import path from "path";
import fs from "fs";
import puppeteer from "puppeteer";
import { prisma } from "@/config/prisma.js";
import { redis } from "@/config/redis.js";

export const formatQuota = (q: unknown): string | null => {
  if (!q) return null;
  const key = String(q).trim();
  const map: Record<string, string> = {
    "(GEN)": "সাধারণ (GEN)",
    "(DIS)": "বিশেষ চাহিদা সম্পন্ন ছাত্র (DIS)",
    "(FF)": "মুক্তিযোদ্ধার সন্তান (FF)",
    "(GOV)": "সরকারী প্রাথমিক বিদ্যালয়ের ছাত্র (GOV)",
    "(ME)": "শিক্ষা মন্ত্রণালয়ের কর্মকর্তা-কর্মচারী (ME)",
    "(SIB)": "সহোদর ভাই (SIB)",
    "(TWN)": "যমজ (TWN)",
    "(Mutual Transfer)": "পারস্পরিক বদলি (Mutual Transfer)",
    "(Govt. Transfer)": "সরকারি বদলি (Govt. Transfer)",
  };

  if (map[key]) return map[key];

  const normalized = key.replace(/\s+/g, " ").trim();
  if (map[normalized]) return map[normalized];

  const noParens = normalized.replace(/[()]/g, "").trim();
  const withParens = `(${noParens})`;
  if (map[withParens]) return map[withParens];

  return normalized;
};

export const generateAdmissionPDF = async (admission) => {
  try {
    console.log(`Generating pdf for ${admission.id}`);

    const admissionSettings = await prisma.admission.findFirst();
    function normalizeClassKey(c) {
      if (!c) return "";
      const s = String(c).trim().toLowerCase();
      if (s === "6" || s.includes("6") || s.includes("six")) return "6";
      if (s === "7" || s.includes("7") || s.includes("seven")) return "7";
      if (s === "8" || s.includes("8") || s.includes("eight")) return "8";
      if (s === "9" || s.includes("9") || s.includes("nine")) return "9";
      return "";
    }
    const classNumMatch = String(admission.admission_class || "");
    const classNum = normalizeClassKey(classNumMatch);
    const sectionInstructions = admissionSettings?.instruction || null;
    const attachmentInstructions =
      (classNum &&
        admissionSettings?.[`attachment_instruction_class${classNum}`]) ||
      "-";

    const logoPath = path.join("public", "icon.jpg");
    const logoExists = fs.existsSync(logoPath);

    let logoBase64 = "";
    if (logoExists) {
      try {
        const logoBuffer = fs.readFileSync(logoPath);
        const logoExtension = path.extname(logoPath).toLowerCase();
        const mimeType =
          logoExtension === ".png"
            ? "image/png"
            : logoExtension === ".jpg" || logoExtension === ".jpeg"
              ? "image/jpeg"
              : "image/png";
        logoBase64 = `data:${mimeType};base64,${logoBuffer.toString("base64")}`;
      } catch (logoError) {
        console.warn("Failed to load logo:", logoError);
      }
    }

    const solaimanLipiPath = path.join("public", "fonts", "SolaimanLipi.woff2");
    const timesNewRomanPath = path.join("public", "fonts", "times.ttf");

    function loadFontAsBase64(fontPath) {
      try {
        if (!fontPath || !fs.existsSync(fontPath)) return null;
        const buf = fs.readFileSync(fontPath);
        return buf.toString("base64");
      } catch (err) {
        console.warn(
          "Failed to load font:",
          fontPath,
          err && err.message ? err.message : err,
        );
        return null;
      }
    }

    const solaimanLipiBase64 = loadFontAsBase64(solaimanLipiPath);
    const timesNewRomanBase64 = loadFontAsBase64(timesNewRomanPath);

    function formatDateLong(dateStr) {
      if (!dateStr) return "";
      let d, m, y;
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
        [d, m, y] = dateStr.split("/");
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        [y, m, d] = dateStr.split("-");
      } else {
        return dateStr;
      }
      const dateObj = new Date(`${y}-${m}-${d}`);
      if (isNaN(dateObj)) return dateStr;
      return dateObj
        .toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
        .replace(/(\w+)\s(\d{4})/, "$1, $2");
    }

    function normalizeUnicode(text) {
      if (!text) return "";
      return text.normalize("NFC");
    }
    function handleList(text) {
      if (!text) return "";
      let normalizedText = text.normalize("NFC");
      normalizedText = normalizedText.replace(
        /([\u0980-\u09FF\u0964-\u096F]+)|([^\u0980-\u09FF\u0964-\u096F]+)/g,
        (_, bn, nonBn) => {
          if (bn) return `<span >${bn}</span>`;
          if (nonBn) return `<span class="en">${nonBn}</span>`;
          return _;
        },
      );

      return normalizedText;
    }

    function wrapBnEn(text) {
      if (!text) return "";

      text = normalizeUnicode(text);

      return text.replace(
        /([\u0980-\u09FF\u0964-\u096F]+)|([^\u0980-\u09FF\u0964-\u096F]+)/g,
        (match, bn, nonBn) => {
          if (bn) return `<span class="bn">${bn}</span>`;
          if (nonBn) return `<span class="en">${nonBn}</span>`;
          return match;
        },
      );
    }

    const row = (label, value, rowIndex = 0) => `
      <tr style="background:${rowIndex % 2 === 1 ? "#e0e7ef" : "inherit"};">
        <td style="border:1px solid #bbb;padding:4px 8px;width:270px;background:${rowIndex % 2 === 1 ? "#e0e7ef" : "#f9fafb"
      };font-weight:500;">${wrapBnEn(label)}</td>
        <td style="border:1px solid #bbb;padding:4px 8px;background:${rowIndex % 2 === 1 ? "#e0e7ef" : "inherit"
      };">${value || '<span style="color:#aaa;">N/A</span>'}</td>
      </tr>
    `;
    const joinAddr = (v, po, pc, upz, dist) =>
      [v, po ? (pc ? `${po} (${pc})` : po) : "", upz, dist]
        .filter(Boolean)
        .map((s) => s.trim())
        .filter(Boolean)
        .join(", ");

    const studentDetailsRaw = [
      ["ছাত্রের নাম:", admission.student_name_bn || null],
      [
        "Student's Name:",
        admission.student_name_en
          ? admission.student_name_en.toUpperCase()
          : null,
      ],
      ["Birth Registration Number:", admission.birth_reg_no || null],
      ["Registration Number:", admission.registration_no || null],
      [
        "Date of Birth:",
        admission.birth_date ? formatDateLong(admission.birth_date) : null,
      ],
      ["Email Address:", admission.email || null],
      [
        "Mobile Numbers:",
        [admission.father_phone, admission.mother_phone]
          .filter(Boolean)
          .join(", ") || null,
      ],
      ["পিতার নাম:", admission.father_name_bn || null],
      [
        "Father's Name:",
        admission.father_name_en
          ? admission.father_name_en.toUpperCase()
          : null,
      ],
      ["Father's National ID Number:", admission.father_nid || null],
      ["মাতার নাম:", admission.mother_name_bn || null],
      [
        "Mother's Name:",
        admission.mother_name_en
          ? admission.mother_name_en.toUpperCase()
          : null,
      ],
      ["Mother's National ID Number:", admission.mother_nid || null],
      [
        "Guardian's Name:",
        [
          admission.guardian_name ? `Name: ${admission.guardian_name}` : null,
          admission.guardian_relation
            ? `Relation: ${admission.guardian_relation}`
            : null,
          admission.guardian_phone
            ? `Phone: ${admission.guardian_phone}`
            : null,
        ]
          .filter(Boolean)
          .join(", ") || null,
      ],
      [
        "Guardian's Address:",
        joinAddr(
          admission.guardian_village_road,
          admission.guardian_post_office,
          admission.guardian_post_code,
          admission.guardian_upazila,
          admission.guardian_district,
        ) || null,
      ],
      [
        "Permanent Address:",
        joinAddr(
          admission.permanent_village_road,
          admission.permanent_post_office,
          admission.permanent_post_code,
          admission.permanent_upazila,
          admission.permanent_district,
        ) || null,
      ],
      [
        "Present Address:",
        joinAddr(
          admission.present_village_road,
          admission.present_post_office,
          admission.present_post_code,
          admission.present_upazila,
          admission.present_district,
        ) || null,
      ],
      [
        "Previous School Name & Address:",
        [
          admission.prev_school_name,
          admission.prev_school_upazila,
          admission.prev_school_district,
        ]
          .filter(Boolean)
          .join(", ") || null,
      ],
      [
        "Previous School Academic Info:",
        [
          admission.section_in_prev_school
            ? `Section: ${admission.section_in_prev_school}`
            : null,
          admission.roll_in_prev_school
            ? `Roll: ${admission.roll_in_prev_school}`
            : null,
          admission.prev_school_passing_year
            ? `Passing Year: ${admission.prev_school_passing_year}`
            : null,
        ]
          .filter(Boolean)
          .join(", ") || null,
      ],
    ];

    const studentDetails = studentDetailsRaw
      .map(([label, value]) => [label, value ? wrapBnEn(String(value)) : ""])
      .filter(
        ([, value]) =>
          value &&
          value.trim() !== "" &&
          value !== '<span class="en">No</span>',
      );

    let tableRows = "";
    studentDetails.forEach(([label, value], idx) => {
      tableRows += row(label, value, idx);
    });
    const defaultOngikar = `১. বিদ্যালয় কর্তৃক নির্ধারিত পোষাক (ইউনিফর্ম) পরে উপস্থিত থাকতে হবে।
                  ২. বিদ্যালয়ে নিয়মিত উপস্থিত থাকতে হবে এবং শ্রেণি কার্যক্রমে সক্রিয় অংশগ্রহণ করতে হবে।
                  ৩. মাথার চুল, হাত-পায়ের পরিচ্ছন্নতা সংক্রান্ত নিয়ম মেনে চলবে এবং নির্ধারিত নিয়ম অনুযায়ী হবে।
                  ৪. বিদ্যালয়ের স্থাপত্য ও সকল নিয়মাবলী যথাযথভাবে মেনে চলতে হবে এবং বিদ্যালয়ের পরিবেশ সুপরিচ্ছন্ন রাখা হবে।
                  ৫. বিদ্যালয়ের শিষ্টাচার ও আচরণবিধি মেনে চলতে হবে; লজ্জাজনক বা অশোভন আচরণ করলে প্রয়োজনীয় শাস্তিমূলক ব্যবস্থা নেওয়া হবে।
                  ৬. উপরোক্ত শর্তাবলী বা বিদ্যালয়ের নিয়ম লঙ্ঘন করলে ভর্তি বাতিলসহ কর্তৃপক্ষ অনুযায়ী সিদ্ধান্ত নেওয়া হবে।`;

    const ongikar =
      admissionSettings && admissionSettings.ingikar
        ? String(admissionSettings.ingikar)
        : defaultOngikar;
    const schoolName = "Panchbibi Lal Bihari Pilot Govt. High School";
    const schoolAddr = "Panchbibi, Joypurhat";
    const schoolWeb = "www.lbphs.gov.bd";
    const admission_year = admission.admission_year || "";

    // prepare display strings for title: use list_type, admission_class and admission_year
    const admission_class_raw = admission.admission_class || "";
    const list_type_raw = admission.list_type || "";
    const admission_class_display = String(admission_class_raw).trim();
    const list_type_display = String(list_type_raw)
      .trim()
      .replace(/(^|\s)\S/g, (s) => s.toUpperCase());

    const titleLabel = `Student's Information for Admission ${list_type_display ? `(${list_type_display})` : ""
      }${admission_class_display ? ` in Class ${admission_class_display}` : ""}${admission_year ? ` ${admission_year}` : ""
      }`;

    const slNoRaw = admission.serial_no || "";
    const registrationRaw = admission.registration_no || "";
    const admissionUserIdRaw = admission.admission_user_id || "";
    const quotaRaw = wrapBnEn(formatQuota(admission.qouta)) || "";

    const slNoDisplay = String(slNoRaw).trim();
    const registrationDisplay = String(registrationRaw).trim();
    const admissionUserIdDisplay = String(admissionUserIdRaw).trim();
    const quotaDisplay = String(quotaRaw)
      .trim()
      .replace(/(^|\s)\S/g, (s) => s.toUpperCase());
    const religionDisplay = admission.religion || "";

    const currentDateTime = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka" }),
    ).toLocaleString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    const html = `
     <!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <title>${titleLabel || "Admission Form"}</title>
  <style>
    @page {
      size: legal;
      margin: 24px;
    }
    
    ${solaimanLipiBase64
        ? `
    @font-face {
      font-family: 'SolaimanLipi';
      src: url('data:font/truetype;charset=utf-8;base64,${solaimanLipiBase64}') format('woff2');
      font-weight: normal;
      font-style: normal;
      font-display: block;
      unicode-range: U+0980-U+09FF, U+0964-U+096F;
    }`
        : ""
      }
    
    ${timesNewRomanBase64
        ? `
    @font-face {
      font-family: 'TimesNewRoman';
      src: url('data:font/truetype;charset=utf-8;base64,${timesNewRomanBase64}') format('truetype');
      font-weight: normal;
      font-style: normal;
      font-display: block;
      unicode-range: U+0020-U+007F, U+00A0-U+00FF;
    }`
        : ""
      }
    
    body, html {
      height: 100%;
      margin: 0;
      padding: 0;
      page-break-inside: avoid;
      page-break-after: avoid;
      font-size: 1rem;
    }
    .page-container {
      position: relative;
      min-height: 100vh;
      height: 100vh;
      width: 100vw;
      box-sizing: border-box;
      font-family: ${solaimanLipiBase64
        ? "'SolaimanLipi', 'Noto Sans Bengali', 'Mukti', 'Solaiman Lipi'"
        : "'Noto Sans Bengali', 'Mukti', 'Solaiman Lipi'"
      }, sans-serif;
      background: #fff;
      page-break-inside: avoid;
      page-break-after: avoid;
      font-size: 1rem;
    }
    .content-area {
      box-sizing: border-box;
      padding: 0 0 100px 0;
      min-height: 0;
      height: calc(100vh - 100px);
      overflow: hidden;
      font-size: 1rem;
    }
    
    .bn, .bn * {
      font-family: ${solaimanLipiBase64
        ? "'SolaimanLipi', 'Noto Sans Bengali', 'Mukti', 'Solaiman Lipi'"
        : "'Noto Sans Bengali', 'Mukti', 'Solaiman Lipi'"
      }, sans-serif !important;
      font-weight: 400 !important;
      font-feature-settings: "liga" 1, "kern" 1, "calt" 1;
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      -webkit-text-stroke: 0.01em transparent;
      font-variant-ligatures: common-ligatures contextual;
      font-size: 0.95rem;
    }
    .en, .en * {
      font-family: ${timesNewRomanBase64
        ? "'TimesNewRoman', 'Times New Roman'"
        : "'Times New Roman'"
      }, serif !important;
      letter-spacing: 0.02em;
      font-size: .95rem;
    }
    
    * {
      unicode-bidi: bidi-override;
      direction: ltr;
      font-size: 1rem;
    }
    
    .bn::before, .bn::after {
      font-family: ${solaimanLipiBase64
        ? "'SolaimanLipi', 'Noto Sans Bengali'"
        : "'Noto Sans Bengali'"
      }, sans-serif !important;
      font-size: 1rem;
    }
    
    .header { 
      position: relative;
      text-align: center; 
      margin-bottom: 12px;
      padding: 12px 0 8px 0;
      font-size: 1rem;
    }
    .monogram {
      position: absolute;
      left: 0;
      top: 8px;
      width: 80px;
      height: 80px;
      ${!logoBase64
        ? `
        background: #f0f0f0;
        border: 2px solid #ccc;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1rem;
        color: #666;
        text-align: center;
        line-height: 1.2;
      `
        : ""
      }
    }
    .monogram img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      border-radius: 50%;
    }
    .header .school { 
      font-size: 1rem; 
      font-weight: bold; 
      margin-bottom: 6px;
      line-height: 1.3;
    }
    .header .addr { 
      font-size: 1rem; 
      margin-bottom: 4px;
      font-weight: 500;
    }
    .header .web { 
      font-size: 1rem; 
    }
    .title-row { 
      background: #e3f0fa; 
      font-size: 1rem; 
      font-weight: bold; 
      text-align: center; 
      border: 1px solid #bbb; 
      padding: 8px 0; 
      margin-top: 8px;
    }
    .section-row { 
      background: #f1f5f9; 
      font-size: 1rem; 
      font-weight: 500; 
      text-align: center; 
      border: 1px solid #bbb; 
      padding: 6px 0; 
    }
    .instructions-section {
      border: 1px solid #000;
      border-radius: 4px;
      padding: 12px;
      margin: 8px 0;
      font-size: 0.9rem;
      line-height: 1;
      text-align: justify;
    }
    .instructions-title {
      font-weight: bold;
      color: #8b5a00;
      margin-bottom: 8px;
      font-size: 1rem;
      line-height: 1;
    }
    .instructions-content {
      white-space: pre-line;
      text-align: justify;
      line-height: 0.9;
      font-size: 0.9rem;
    }
    table { 
      border-collapse: collapse; 
      width: 100%; 
      margin-top: 0.5rem; 
      font-size: 1rem; 
      page-break-inside: avoid;
    }
    tr {
      page-break-inside: avoid;
    }
    th, td { 
      border: 1px solid #bbb; 
      padding: 4px 8px;
      font-size: 1rem;
    }
    th { 
      background: #f3f6fa; 
    }
    .footer .note .b {
      font-weight: 400;
      margin-bottom: 4px;
      font-size: 1rem;
    }
    .footer .note .bn {
      font-family: ${solaimanLipiBase64
        ? "'SolaimanLipi', 'Noto Sans Bengali'"
        : "'Noto Sans Bengali'"
      }, sans-serif !important;
      font-size: 1rem;
      white-space: pre-wrap;
    }
    .footer .note .en {
      font-family: ${timesNewRomanBase64 ? "'TimesNewRoman'" : "'Times New Roman'"
      }, serif !important;
      font-size: 1rem;
    }
    .document-list {
      margin-top: 6px;
      padding-left: 0;
      font-size: 0.98rem;
    }
    .document-list .bn {
      display: block;
      font-size: 0.98rem;
      line-height: 1.02;
      white-space: pre-line;
      margin-bottom: 3px;
      font-family: ${solaimanLipiBase64
        ? "'SolaimanLipi', 'Noto Sans Bengali'"
        : "'Noto Sans Bengali'"
      }, sans-serif !important;
    }
    .document-list .bn.document-list-title,
    .document-list-title.bn,
    .document-list-title {
      font-weight: 600 !important;
      font-size: 0.9rem !important;
      display: block !important;
      margin-bottom: 1px !important;
      font-family: ${solaimanLipiBase64
        ? "'SolaimanLipi', 'Noto Sans Bengali', 'Mukti', 'Solaiman Lipi'"
        : "'Noto Sans Bengali', 'Mukti', 'Solaiman Lipi'"
      }, sans-serif !important;
    }
    .footer .note p {
      margin: 4px 0;
      line-height: 1.05;
      font-size: 0.95rem;
    }
    .instructions-section {
      border: 1px solid #000;
      border-radius: 4px;
      padding: 10px;
      margin: 6px 0;
      font-size: 0.9rem;
      text-align: justify;
    }
    .signature-row {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 20px;
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding-bottom: 8px;
      background: white;
      box-sizing: border-box;
      font-size: 1rem;
    }
    .signature-cell {
      flex: 1 1 0;
      text-align: center;
      vertical-align: bottom;
      min-width: 120px;
      max-width: 180px;
      padding: 0 4px;
      font-size: 1rem;
    }
    .signature-line {
      border-top: 1px dotted #222;
      margin-bottom: 0px;
      width: 95%;
      height: 6px;
      margin-left: auto;
      margin-right: auto;
    }
    .signature-label {
      font-size: 1rem;
      font-weight: 500;
      margin-top: 0px;
      font-family: ${solaimanLipiBase64
        ? "'SolaimanLipi', 'Noto Sans Bengali'"
        : "'Noto Sans Bengali'"
      }, sans-serif !important;
      white-space: nowrap;
    }
    .bottom-info {
      position: absolute;
      left: 0;
      right: 0;
      bottom: -4px;
      width: 100%;
      text-align: center;
      font-size: 0.75rem;
      color: #555;
      background: white;
      padding: 4px 0;
    }
  </style>
</head>
<body>
  <div class="page-container">
    <div class="content-area">
      <div class="header">
        <div class="monogram">
          ${logoBase64
        ? `<img src="${logoBase64}" alt="School Logo" />`
        : "School<br>Logo"
      }
        </div>
        <div class="school en">${schoolName}</div>
        <div class="addr en">${schoolAddr}</div>
        <div class="web en">${schoolWeb}</div>
      </div> 
      <div class="title-row en">
        ${titleLabel}
      </div>
      <div class="section-row"> 
  <span class="en">SL No:</span> <span class="en">${slNoDisplay}</span>,
  ${registrationDisplay
        ? `<span class="en"> Reg No:</span> <span class="en">${registrationDisplay}</span>,`
        : ""
      }
  <span class="en"> User ID:</span> <span class="en">${admissionUserIdDisplay}</span>,
        <span class="en"> Quota:</span> ${quotaDisplay},
        <span class="en"> Religion:</span> ${wrapBnEn(religionDisplay)}
      </div>
      <table>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
      ${sectionInstructions
        ? `
      <div class="instructions-section">
        <div class="instructions-content">${wrapBnEn(sectionInstructions)}</div>
      </div>
      `
        : ""
      }
      <div class="footer">
        <div class="note">
          <div class="document-list">
            <span class="bn document-list-title">* প্রিন্টকৃত ফরমের সাথে যেসব কাগজপত্র সংযুক্ত করতে হবে:</span>
            ${attachmentInstructions
        ? attachmentInstructions
          .split(/\r?\n|\r/)
          .map((line) => {
            if (line) {
              return `<span class="bn">${handleList(line)}</span>`;
            }
            return "";
          })
          .filter(Boolean)
          .join("")
        : ""
      }
          </div>
          <p style="font-size:1rem; margin-top:8px;">
          * পূর্ববর্তী বিদ্যালয়ের মূল ছাড়পত্র ভর্তির সময় দিতে না পারলে পরীক্ষার ফল প্রকাশের পর অবশ্যই জমা দিতে হবে। অন্যথায় ভর্তি বাতিল হবে।
          </br>
          ** ভর্তির সময় উল্লিখিত সকল কাগজপত্রের মূলকপি অবশ্যই ভর্তি কমিটিকে দেখাতে হবে।
          </p>
          <div style="margin-top:8px;">
            <div class="bn" style="font-weight:700 !important; font-size:1.05rem; text-align:center; display:block;">ছাত্রের অঙ্গীকারনামা</div>
            ${ongikar
        ? `
              <div class="instructions-section">
                <div class="instructions-content">${wrapBnEn(ongikar)}</div>
              </div>
              `
        : ""
      }
          </div>
        </div>
      </div>
    </div>
    <div class="signature-row bn" style="gap: 8px; padding-bottom: 0px;">
      <div class="signature-cell" style="flex: 1; text-align: center; min-width: 140px;">
        <div class="signature-line"></div>
        <div class="signature-label bn" style="font-size: 0.9rem;">ছাত্রের স্বাক্ষর</div>
      </div>
      <div class="signature-cell" style="flex: 1; text-align: center; min-width: 140px;">
        <div class="signature-line"></div>
        <div class="signature-label bn" style="font-size: 0.9rem;">পিতা/মাতা/বৈধ অভিভাবকের স্বাক্ষর</div>
      </div>
      <div class="signature-cell" style="flex: 1; text-align: center; min-width: 140px;">
        <div class="signature-line"></div>
        <div class="signature-label bn" style="font-size: 0.9rem;">দায়িত্বপ্রাপ্ত শিক্ষকের স্বাক্ষর, তারিখ ও সিল</div>
      </div>
    </div>
    <div class="bottom-info en">
      Emergency Contact: 01309-121983 | Generated: ${currentDateTime}
    </div>
  </div>
</body>
</html>
    `;
    const launchOptions = {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-font-subpixel-positioning",
        "--disable-features=TranslateUI",
        "--disable-ipc-flooding-protection",
        "--font-render-hinting=medium",
        "--enable-font-antialiasing",
        "--disable-extensions",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-default-apps",
        "--force-device-scale-factor=1",
        "--disable-lcd-text",
        "--lang=bn-BD",
      ],
    };
    const isWindows = process.platform === "win32";
    const chromePath = isWindows
      ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
      : process.env.PUPPETEER_EXECUTABLE_PATH;
    launchOptions.executablePath = chromePath;
    let browser = null;
    // keys to record worker-side status/errors when called directly or from worker
    const statusKey = `pdf:${admission.id}:status`;
    const errorKey = `pdf:${admission.id}:error`;
    try {
      try {
        browser = await puppeteer.launch(launchOptions);
      } catch (launchErr) {
        console.error(
          "Puppeteer launch failed for admissionId:",
          admission.id,
          launchErr && launchErr.stack ? launchErr.stack : launchErr,
        );
        try {
          await redis.set(statusKey, "failed");
          await redis.set(
            errorKey,
            `launch error: ${launchErr && launchErr.stack ? launchErr.stack : launchErr
            }`,
          );
        } catch (rErr) {
          console.error(
            "Failed to write launch error to Redis:",
            rErr && rErr.message ? rErr.message : rErr,
          );
        }
        throw launchErr;
      }
      const page = await browser.newPage();

      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      );
      await page.setExtraHTTPHeaders({
        "Accept-Charset": "utf-8",
        "Accept-Language": "bn-BD,bn;q=0.9,en;q=0.8",
      });

      await page.setContent(html, {
        waitUntil: ["networkidle0", "domcontentloaded"],
      });
      await page.evaluate(() => {
        /* global document, NodeFilter */
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
          null,
          false,
        );

        let node;
        while ((node = walker.nextNode())) {
          if (node.nodeValue) {
            node.nodeValue = node.nodeValue.normalize("NFC");
          }
        }

        return new Promise((resolve) => {
          if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(() => {
              setTimeout(resolve, 1000);
            });
          } else {
            setTimeout(resolve, 2000);
          }
        });
      });

      let pdfBuffer;
      try {
        pdfBuffer = await page.pdf({
          format: "legal",
          printBackground: true,
          margin: { top: 24, bottom: 24, left: 24, right: 24 },
          preferCSSPageSize: true,
          pageRanges: "1",
        });
      } catch (pdfErr) {
        console.error(
          "page.pdf failed for admissionId:",
          admission.id,
          pdfErr && pdfErr.stack ? pdfErr.stack : pdfErr,
        );
        throw pdfErr;
      }
      console.log(
        "PDF generated for admission ID:",
        admission.id,
        "bytes=",
        pdfBuffer.length,
      );
      await browser.close();
      return pdfBuffer;
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch (closeErr) {
          console.warn(
            "Failed to close browser after PDF generation:",
            closeErr && closeErr.message ? closeErr.message : closeErr,
          );
        }
      }
    }
  } catch (error) {
    console.error("PDF generation error:", error);
    throw error;
  }
};
