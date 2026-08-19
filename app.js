// PDF CleanSpace AI Pro - Executive Slate Processing Engine

if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = window.location.origin + '/vendor/pdf.worker.min.js';
}

let currentSessionId = null;
let currentFileObject = null;
let rawFileUint8Array = null;
let pagesData = [];
let fullExtractedText = "";
let currentFilename = "";
let isServerMode = false;
let batchQueue = [];
let currentBatchIndex = -1;
let mainCutIndices = new Set();
let isSplitModeEnabled = false;
let currentInspectIndex = 0;

let inspectZoomScale = 1.0;
let modalZoomScale = 1.0;

function getSavedBaseDir() {
  return localStorage.getItem("operator_base_dir") || "";
}

function saveBaseDir(val) {
  if (val !== undefined && val !== null) {
    const cleanVal = val.trim();
    if (cleanVal) {
      localStorage.setItem("operator_base_dir", cleanVal);
    } else {
      localStorage.removeItem("operator_base_dir");
    }
  }
}

let extractedMetadata = {
  category: "Employee", // Employee | Family | Retired
  personName: "John Doe",
  gender: "Male",
  age: "",
  refNo: "EMP-1092",
  recordDate: "2026-08-17",
  baseDir: getSavedBaseDir()
};

// Grid Thumbnail Scale Handler
function setGridScale(val) {
  document.documentElement.style.setProperty('--grid-thumb-size', `${val}px`);
}

function toggleSplitScissorMode() {
  isSplitModeEnabled = !isSplitModeEnabled;
  updateSplitButtonsUI();
  renderPageGrid();
}

function toggleMainScissorCut(pageIndex) {
  if (mainCutIndices.has(pageIndex)) {
    mainCutIndices.delete(pageIndex);
  } else {
    mainCutIndices.add(pageIndex);
  }
  updateSplitButtonsUI();
  renderPageGrid();
}

function updateSplitButtonsUI() {
  const cutsCount = mainCutIndices.size;
  const partsCount = cutsCount + 1;

  const topBtn = document.getElementById("top-split-toggle-btn");
  const gridBtn = document.getElementById("grid-split-toggle-btn");

  const gridDlBtn = document.getElementById("grid-download-btn");
  const bottomDlBtn = document.getElementById("bottom-download-btn");

  const statusLabel = cutsCount > 0 ? `✂️ Split Mode (${cutsCount} Cut${cutsCount > 1 ? 's' : ''} -> ${partsCount} PDFs)` : `✂️ Split Mode (${isSplitModeEnabled ? 'Active' : 'Disabled'})`;

  if (topBtn) topBtn.innerText = statusLabel;
  if (gridBtn) gridBtn.innerText = statusLabel;

  if (cutsCount > 0) {
    if (gridDlBtn) gridDlBtn.innerText = `💾 Download ${partsCount} Split PDFs`;
    if (bottomDlBtn) bottomDlBtn.innerText = `💾 Download ${partsCount} Split PDFs`;
  } else {
    if (gridDlBtn) gridDlBtn.innerText = `⚡ Auto-Save to Target Folder`;
    if (bottomDlBtn) bottomDlBtn.innerText = `⚡ Auto-Save to Target Folder`;
  }
}

function switchTab(tabName) {
  const views = ['single', 'batch', 'split', 'viewer'];
  const tabBtns = document.querySelectorAll('.nav-tabs .tab-btn');
  
  views.forEach((v, idx) => {
    const sec = document.getElementById(`${v}-view`);
    if (sec) sec.classList.remove('active');
    if (tabBtns[idx]) tabBtns[idx].classList.remove('active');
  });

  const activeSec = document.getElementById(`${tabName}-view`);
  if (activeSec) activeSec.classList.add('active');
  
  const targetIdx = views.indexOf(tabName);
  if (targetIdx !== -1 && tabBtns[targetIdx]) {
    tabBtns[targetIdx].classList.add('active');
  }

  // Bottom action bar visibility control
  const bottomBar = document.getElementById("bottom-action-bar");
  if (bottomBar) {
    if (tabName === 'single' && pagesData.length > 0) {
      bottomBar.style.display = 'flex';
    } else {
      bottomBar.style.display = 'none';
    }
  }

  if (tabName === 'viewer') {
    initPdfViewer();
  }
}

// Drag and drop setup
const dropzone = document.getElementById("dropzone");

if (dropzone) {
  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('drag-over');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('drag-over');
    }, false);
  });

  dropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      uploadPdfFile(files[0]);
    }
  });
}

function handleFileSelect(event) {
  const files = event.target.files;
  if (files.length > 0) {
    uploadPdfFile(files[0]);
  }
}

function showLoading(text = "Analyzing PDF Document...") {
  const el = document.getElementById("loading-overlay");
  if (el) {
    const txtEl = document.getElementById("loading-text");
    if (txtEl) txtEl.innerText = text;
    el.classList.add("active");
  }
}

function hideLoading() {
  const el = document.getElementById("loading-overlay");
  if (el) el.classList.remove("active");
}

// Demo Sample PDF Generator
async function loadSamplePdfDemo() {
  showLoading("Generating sample PDF demo document...");
  try {
    const pdfDoc = await PDFLib.PDFDocument.create();
    
    // Page 1: Valid Content with Employee Record Details
    const page1 = pdfDoc.addPage([600, 800]);
    const { width, height } = page1.getSize();
    page1.drawText("PDF CleanSpace AI Pro - Demo Sample Document", {
      x: 50,
      y: height - 80,
      size: 20
    });
    page1.drawText("Employee Name: John Doe", {
      x: 50,
      y: height - 120,
      size: 14
    });
    page1.drawText("Gender: Male | Age: 35", {
      x: 50,
      y: height - 145,
      size: 13
    });
    page1.drawText("Ref No: EMP-1092", {
      x: 50,
      y: height - 170,
      size: 13
    });
    page1.drawText("Date: 2026-08-17", {
      x: 50,
      y: height - 195,
      size: 12
    });
    page1.drawText("Department of Operations & Engineering HR Record.", {
      x: 50,
      y: height - 225,
      size: 12
    });

    // Page 2: Completely Blank Page
    pdfDoc.addPage([600, 800]);

    // Page 3: Rotated Page (90 degrees)
    const page3 = pdfDoc.addPage([800, 600]);
    page3.drawText("MISORIENTED PAGE - AI Auto-Rotation Test", {
      x: 100,
      y: 300,
      size: 18
    });

    const pdfBytes = await pdfDoc.save();
    rawFileUint8Array = new Uint8Array(pdfBytes);
    currentFilename = "PDF_CleanSpace_Demo_Sample.pdf";
    currentFileObject = null;

    await processPdfInBrowser(rawFileUint8Array);
  } catch (err) {
    alert("Error generating sample demo: " + err.message);
  } finally {
    hideLoading();
  }
}

async function uploadPdfFile(file) {
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    alert("Please select a valid PDF document.");
    return;
  }

  currentFilename = file.name;
  currentFileObject = file;
  showLoading("Scanning pages for blank content & orientation...");

  // Try API upload first if server is running
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("blank_sensitivity", 0.8);

    const res = await fetch("/api/upload", { method: "POST", body: formData });
    if (res.ok) {
      const data = await res.json();
      currentSessionId = data.session_id;
      isServerMode = true;

      pagesData = data.pages.map(page => ({
        ...page,
        page_index: page.page_num - 1,
        original_index: page.page_num - 1,
        thumbnail_url: `/api/thumbnail/${currentSessionId}/${page.page_num - 1}?max_size=350`,
        user_rotation: page.suggested_rotation,
        user_deleted: page.is_blank
      }));

      onScanCompleted();
      return;
    }
  } catch (e) {
    console.log("Server API unavailable, falling back to instant browser client-side engine.");
  }

  // Client-Side Browser Engine (Zero-Install)
  try {
    isServerMode = false;
    const arrayBuffer = await file.arrayBuffer();
    rawFileUint8Array = new Uint8Array(arrayBuffer);
    await processPdfInBrowser(rawFileUint8Array);
  } catch (err) {
    alert("Error processing PDF: " + err.message);
  } finally {
    hideLoading();
  }
}

async function processPdfInBrowser(uint8ArrayData) {
  const pdfDataCopy = uint8ArrayData.slice();
  const loadingTask = pdfjsLib.getDocument({ data: pdfDataCopy });
  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;

  pagesData = [];
  fullExtractedText = "";

  for (let i = 1; i <= numPages; i++) {
    showLoading(`AI Scanning page ${i} of ${numPages}...`);
    const page = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale: 0.75 });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: ctx, viewport: viewport }).promise;

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imgData.data;
    const w = canvas.width;
    const h = canvas.height;
    const totalPixels = pixels.length / 4;

    // PASS 1: Word Count & Text Extraction
    const textContent = await page.getTextContent();
    let textCharCount = 0;
    let bodyWordCount = 0;
    let pageTextStr = "";

    textContent.items.forEach(item => {
      const str = item.str.trim();
      pageTextStr += str + " ";
      textCharCount += str.length;
      if (str.length > 0) {
        const validWords = str.split(/\s+/).filter(w => w.replace(/[^a-zA-Z0-9]/g, '').length >= 2);
        bodyWordCount += validWords.length;
      }
    });

    fullExtractedText += ` Page ${i}: ` + pageTextStr;

    // PASS 2: 5x5 Spatial Tile Distribution Analysis
    const gridRows = 5, gridCols = 5;
    const cellW = Math.floor(w / gridCols);
    const cellH = Math.floor(h / gridRows);
    let maxGridDarkRatio = 0.0;
    let totalDarkPixels = 0;
    let activeTiles = 0;
    const activeRowSet = new Set();

    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        let cellDarkPixels = 0;
        let cellTotal = 0;

        for (let y = r * cellH; y < Math.min((r + 1) * cellH, h); y += 2) {
          for (let x = c * cellW; x < Math.min((c + 1) * cellW, w); x += 2) {
            const idx = (y * w + x) * 4;
            const brightness = (pixels[idx] + pixels[idx + 1] + pixels[idx + 2]) / 3;

            cellTotal++;
            if (brightness < 235) {
              cellDarkPixels++;
              totalDarkPixels++;
            }
          }
        }

        const cellRatio = (cellDarkPixels / cellTotal) * 100.0;
        if (cellRatio > maxGridDarkRatio) {
          maxGridDarkRatio = cellRatio;
        }
        if (cellRatio >= 0.25) {
          activeTiles++;
          activeRowSet.add(r);
        }
      }
    }

    const activeRows = activeRowSet.size;
    const sampledTotal = totalPixels / 4;
    const overallDarkPixelRatio = (totalDarkPixels / sampledTotal) * 100.0;

    // Orientation Angle Detection
    let suggestedRotation = 0;
    let orientationReason = "Standard upright layout (0°)";
    let orientationConfidence = 50;

    if (textContent.items.length > 0) {
      const anglesCount = { 0: 0, 90: 0, 180: 0, 270: 0 };
      let totalWeightedSpans = 0;

      textContent.items.forEach(item => {
        const transform = item.transform;
        const rad = Math.atan2(transform[1], transform[0]);
        let deg = Math.round(rad * (180 / Math.PI)) % 360;
        if (deg < 0) deg += 360;
        
        const closest = [0, 90, 180, 270].reduce((prev, curr) => 
          Math.abs(curr - deg) < Math.abs(prev - deg) ? curr : prev
        );

        const textLen = item.str.trim().length;
        const weight = textLen > 0 ? textLen : 1;
        anglesCount[closest] += weight;
        totalWeightedSpans += weight;
      });

      const dominantAngle = Object.keys(anglesCount).reduce((a, b) => anglesCount[a] > anglesCount[b] ? a : b);
      const angleNum = parseInt(dominantAngle);

      if (totalWeightedSpans > 0 && anglesCount[angleNum] > 0) {
        orientationConfidence = Math.round((anglesCount[angleNum] / totalWeightedSpans) * 100);
        if (angleNum !== 0 && orientationConfidence >= 40) {
          suggestedRotation = (360 - angleNum) % 360;
          orientationReason = `AI Text Vector Engine detected text flow at ${angleNum}°. Auto-rotated to ${suggestedRotation}° upright.`;
        }
      }
    }

    const autoRotateEnabled = document.getElementById("auto-rotate-toggle") ? document.getElementById("auto-rotate-toggle").checked : true;
    const finalRotation = autoRotateEnabled ? suggestedRotation : 0;

    const thumbnailUrl = canvas.toDataURL("image/png");

    const rawPageText = textContent.items ? textContent.items.map(item => item.str).join(" ") : "";
    const pageObj = {
      page_num: i,
      page_index: i - 1,
      original_index: i - 1,
      extracted_text: rawPageText,
      width: viewport.width,
      height: viewport.height,
      current_rotation: page.rotate || 0,
      word_count: bodyWordCount,
      text_char_count: textCharCount,
      dark_pixel_ratio: overallDarkPixelRatio,
      max_grid_density: maxGridDarkRatio,
      active_tiles: activeTiles,
      active_rows: activeRows,
      suggested_rotation: suggestedRotation,
      orientation_confidence: orientationConfidence,
      orientation_reason: orientationReason,
      needs_rotation: suggestedRotation !== 0,
      user_rotation: finalRotation,
      thumbnail_url: thumbnailUrl
    };

    evaluatePageClassification(pageObj);
    pagesData.push(pageObj);
  }

  // AI METADATA EXTRACTION (Employee / Family / Retired)
  extractDocumentMetadata(fullExtractedText);

  onScanCompleted();
  hideLoading();
}

function extractDocumentMetadata(text) {
  if (!text) return;
  const lowerText = text.toLowerCase();

  // 1. CATEGORY CLASSIFIER (Employee / Family / Retired)
  let employeeScore = 0;
  let familyScore = 0;
  let retiredScore = 0;

  const employeeKeywords = ['employee', 'payroll', 'salary', 'designation', 'department', 'employee id', 'hr', 'staff', 'joining date'];
  const familyKeywords = ['family', 'dependant', 'spouse', 'child', 'son', 'daughter', 'relative', 'father', 'mother', 'dependent'];
  const retiredKeywords = ['retired', 'pension', 'ppo', 'pensioner', 'superannuation', 'retiree', 'provident fund', 'epfo', 'gratuity'];

  employeeKeywords.forEach(kw => { if (lowerText.includes(kw)) employeeScore += 2; });
  familyKeywords.forEach(kw => { if (lowerText.includes(kw)) familyScore += 2; });
  retiredKeywords.forEach(kw => { if (lowerText.includes(kw)) retiredScore += 2; });

  let detectedCategory = "Employee";
  if (familyScore > employeeScore && familyScore > retiredScore) {
    detectedCategory = "Family";
  } else if (retiredScore > employeeScore && retiredScore > familyScore) {
    detectedCategory = "Retired";
  } else {
    detectedCategory = "Employee";
  }

  // 2. NAME EXTRACTION
  let extractedName = "";
  const namePatterns = [
    /(?:Employee Name|Patient Name|Pensioner Name|Staff Name|Name of Pensioner|Full Name|Name)\s*[:|-]?\s*([A-Za-z\s\.]{2,25})/i,
    /(?:Mr\.|Ms\.|Mrs\.|Dr\.)\s+([A-Za-z\s\.]{2,25})/i
  ];

  for (const pat of namePatterns) {
    const m = text.match(pat);
    if (m && m[1] && m[1].trim().length >= 3) {
      extractedName = m[1].trim().replace(/[^a-zA-Z\s\.]/g, '');
      break;
    }
  }

  // 3. GENDER EXTRACTION
  let extractedGender = "Male";
  if (/gender\s*:\s*female|sex\s*:\s*female|\bfemale\b/i.test(text)) {
    extractedGender = "Female";
  } else if (/gender\s*:\s*other|\bother\b/i.test(text)) {
    extractedGender = "Other";
  } else {
    extractedGender = "Male";
  }

  // 4. AGE EXTRACTION
  let extractedAge = "";
  const ageMatch = text.match(/(?:Age|Yrs|Years)\s*[:|-]?\s*(\d{1,3})/i) || text.match(/\b(\d{1,2})\s*(?:years|yrs|y\/o)\b/i);
  if (ageMatch && ageMatch[1]) {
    const a = parseInt(ageMatch[1]);
    if (a >= 1 && a <= 120) extractedAge = String(a);
  }

  // 5. ID NUM EXTRACTION
  let extractedId = "";
  const idPatterns = [
    /(?:EMP ID|Employee ID|PPO No|PPO Number|PPO|PF No|Ref No|ID No)\s*[:|-]?\s*([A-Za-z0-9/-]{3,20})/i
  ];

  for (const pat of idPatterns) {
    const m = text.match(pat);
    if (m && m[1] && m[1].trim().length >= 3) {
      extractedId = m[1].trim();
      break;
    }
  }

  let extractedDate = "";
  const dateMatch = text.match(/\b(201[7-9]|202[0-9]|2030)[/-](0[1-9]|1[0-2])[/-](0[1-9]|[12][0-9]|3[01])\b/) ||
                    text.match(/\b(0[1-9]|[12][0-9]|3[01])[/-](0[1-9]|1[0-2])[/-](201[7-9]|202[0-9]|2030)\b/);
  if (dateMatch) {
    extractedDate = dateMatch[0];
  } else {
    const d = new Date();
    extractedDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  const savedBase = getSavedBaseDir() || "D:\\RAILWAY";

  extractedMetadata = {
    category: detectedCategory,
    personName: extractedName || "",
    gender: extractedGender || "Female",
    age: extractedAge || "",
    refNo: extractedId || "",
    recordDate: extractedDate,
    baseDir: savedBase
  };

  const b1 = document.getElementById("rename-base-dir");
  if (b1) b1.value = savedBase;

  updateSmartRenameUI();
}



function parseRecordDate(dateInputStr) {
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const d = new Date();
  let yearStr = String(d.getFullYear());
  let monthNumStr = String(d.getMonth() + 1).padStart(2, '0');
  let dayStr = String(d.getDate()).padStart(2, '0');

  if (dateInputStr && typeof dateInputStr === 'string' && dateInputStr.trim()) {
    const s = dateInputStr.trim();

    // 1. ISO format: YYYY-MM-DD or YYYY/MM/DD
    const isoMatch = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
    if (isoMatch) {
      yearStr = isoMatch[1];
      monthNumStr = String(isoMatch[2]).padStart(2, '0');
      dayStr = String(isoMatch[3]).padStart(2, '0');
    } else {
      // 2. DMY format: DD-MM-YYYY or DD/MM/YYYY
      const dmyMatch = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
      if (dmyMatch) {
        dayStr = String(dmyMatch[1]).padStart(2, '0');
        monthNumStr = String(dmyMatch[2]).padStart(2, '0');
        yearStr = dmyMatch[3];
      } else {
        // 3. Fallback Date.parse
        const parsedMs = Date.parse(s);
        if (!isNaN(parsedMs)) {
          const parsedD = new Date(parsedMs);
          yearStr = String(parsedD.getFullYear());
          monthNumStr = String(parsedD.getMonth() + 1).padStart(2, '0');
          dayStr = String(parsedD.getDate()).padStart(2, '0');
        }
      }
    }
  }

  const mIdx = Math.max(0, Math.min(11, parseInt(monthNumStr) - 1));
  const monthNameStr = monthNames[mIdx];
  const formattedDate = `${dayStr}-${monthNumStr}-${yearStr}`;

  return {
    yearStr,
    monthNumStr,
    dayStr,
    monthNameStr,
    formattedDate
  };
}

function updateAllPreviews() {
  const activeEl = document.activeElement ? document.activeElement.id : "";

  // 1. Read values directly from DOM inputs (single source of truth)
  const catSelect = document.getElementById("rename-category");
  const sName = document.getElementById("rename-person-name");
  const sGender = document.getElementById("rename-gender");
  const sAge = document.getElementById("rename-age");
  const sId = document.getElementById("rename-ref-id");
  const sDate = document.getElementById("rename-date-picker");
  const sBase = document.getElementById("rename-base-dir");

  let catVal = catSelect ? catSelect.value : (extractedMetadata.category || "Employee");
  extractedMetadata.category = catVal;

  let nameVal = sName ? sName.value : (extractedMetadata.personName || "");
  extractedMetadata.personName = nameVal;

  let genderVal = sGender ? sGender.value : (extractedMetadata.gender || "Female");
  extractedMetadata.gender = genderVal;

  let ageVal = sAge ? sAge.value : (extractedMetadata.age || "");
  extractedMetadata.age = ageVal;

  let refVal = sId ? sId.value : (extractedMetadata.refNo || "");
  extractedMetadata.refNo = refVal;

  let dateVal = sDate ? sDate.value : (extractedMetadata.recordDate || "");
  if (dateVal) extractedMetadata.recordDate = dateVal;

  let savedBase = getSavedBaseDir() || "D:\\RAILWAY";
  let rawBaseVal = (sBase && sBase.value.trim()) ? sBase.value.trim() : (extractedMetadata.baseDir || savedBase);
  let cleanBaseDir = (rawBaseVal || "").trim().replace(/^["']+|["']+$|\.lnk$/gi, '').trim();

  if (cleanBaseDir) {
    extractedMetadata.baseDir = cleanBaseDir;
    saveBaseDir(cleanBaseDir);
    if (sBase && activeEl !== "rename-base-dir" && !sBase.value.trim()) {
      sBase.value = cleanBaseDir;
    }
  }

  // 2. Generate clean category prefix
  const rawCat = extractedMetadata.category || "Employee";
  const catPrefix = rawCat.toLowerCase().substring(0, 3);

  // Clean name
  const cleanName = (nameVal || "record").toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '-');

  // Gender (M / F / O)
  const rawGender = genderVal || extractedMetadata.gender || "Female";
  const genderCode = rawGender.trim().toUpperCase().startsWith("M") ? "M" : (rawGender.trim().toUpperCase().startsWith("F") ? "F" : "O");

  // Age digits (or '0' fallback)
  const ageDigits = ageVal ? String(ageVal).trim().replace(/\D/g, '') : "0";

  // Ref digits (or '0' fallback)
  const rawRef = refVal || "";
  const refDigits = rawRef.replace(/\D/g, '') || rawRef.toLowerCase().trim().replace(/[^a-z0-9]/g, '') || "0";

  // Universal Robust Date Parsing (any year/month/day format)
  const parsedDate = parseRecordDate(dateVal);
  const { yearStr, monthNumStr, dayStr, monthNameStr } = parsedDate;

  // Format date as dd-mm-yy (2-digit year)
  const yearYY = yearStr.slice(-2);
  const formattedDateYY = `${dayStr}-${monthNumStr}-${yearYY}`;

  // Format: category_name_gender_age_ref.no._dd-mm-yy.pdf
  const filename = `${catPrefix}_${cleanName}_${genderCode}_${ageDigits}_${refDigits}_${formattedDateYY}.pdf`;

  const displayBaseDir = cleanBaseDir ? cleanBaseDir.replace(/\\$/, '') : "[Set Base Folder]";
  const baseDir = cleanBaseDir ? cleanBaseDir.replace(/\\$/, '') : "";

  const subfolderPath = `\\${rawCat}\\${yearStr}\\${monthNameStr}\\${dayStr}\\`;
  const folderPath = baseDir ? `${baseDir}${subfolderPath}` : `${displayBaseDir}${subfolderPath}`;

  // Sync Category Badge
  const catBadge = document.getElementById("rename-cat-badge");
  if (catBadge) {
    catBadge.className = `cat-badge cat-badge-${rawCat.toLowerCase()}`;
    if (rawCat === "Employee") catBadge.innerText = "💼 EMPLOYEE";
    else if (rawCat === "Family") catBadge.innerText = "👨‍👩‍👧 FAMILY";
    else if (rawCat === "Retired") catBadge.innerText = "👵 RETIRED";
  }

  const subfolderBadge = document.getElementById("rename-subfolder-badge");
  if (subfolderBadge) subfolderBadge.innerText = subfolderPath;

  // Update preview boxes
  const folderPathPreview = document.getElementById("rename-folder-path-preview");
  const modalFolderPathPreview = document.getElementById("modal-folder-path-preview");
  const modalFilenamePreview = document.getElementById("modal-filename-preview");
  const outputFilenameEl = document.getElementById("rename-output-filename");

  if (folderPathPreview) folderPathPreview.innerText = folderPath;
  if (modalFolderPathPreview) modalFolderPathPreview.innerText = folderPath;
  if (modalFilenamePreview) modalFilenamePreview.innerText = filename;

  if (outputFilenameEl && activeEl !== "rename-output-filename") {
    if (!outputFilenameEl.dataset.userEdited) {
      outputFilenameEl.value = filename;
    }
  }
}

function updateSmartRenameUI() {
  updateAllPreviews();
}

function onRenameMetadataChanged() {
  updateAllPreviews();
}

function generateTargetPathAndFilename() {
  updateAllPreviews();
}

function syncModalCategory(val) {
  extractedMetadata.category = val;
  updateAllPreviews();
}

function syncModalInputsToSidebar() {
  updateAllPreviews();
}

function syncModalDate(val) {
  if (val) extractedMetadata.recordDate = val;
  updateAllPreviews();
}

function openSmartRenameModal() {
  updateSmartRenameUI();
  openModal("smart-rename-modal");
}

function evaluatePageClassification(pageObj) {
  const modeEl = document.getElementById("preset-mode");
  const mode = modeEl ? modeEl.value : "standard";
  const sliderEl = document.getElementById("min-words-slider");
  const minWords = sliderEl ? parseInt(sliderEl.value) : 3;

  let isBlank = false;
  let blankReason = "";

  const words = pageObj.word_count || 0;
  const chars = pageObj.text_char_count || 0;
  const tiles = pageObj.active_tiles || 0;
  const rows = pageObj.active_rows || 0;
  const density = pageObj.dark_pixel_ratio || 0;

  if (mode === "handwritten") {
    if (words >= 2 || chars >= 10 || (rows >= 2 && tiles >= 3) || density >= 0.4) {
      isBlank = false;
      blankReason = `Handwritten Content (${words} words, ${density.toFixed(2)}% ink). Preserved.`;
    } else {
      isBlank = true;
      blankReason = `Blank Page: Low ink density (${density.toFixed(2)}%). Auto-deleted.`;
    }
  } else if (mode === "strict") {
    if (words >= 15 || (words >= 5 && density >= 1.5 && tiles >= 6)) {
      isBlank = false;
      blankReason = `Strict Content (${words} words). Preserved.`;
    } else {
      isBlank = true;
      blankReason = `Blank Page: Fails strict threshold (${words} words). Auto-deleted.`;
    }
  } else {
    const hasDigitalText = (words >= minWords);
    const hasVisualTextInk = (rows >= 3 && tiles >= 5) || (density >= 1.2 && tiles >= 5);

    if (hasDigitalText || hasVisualTextInk) {
      isBlank = false;
      blankReason = `Valid Content Page: ${words} digital words (${density.toFixed(2)}% ink). Preserved.`;
    } else {
      isBlank = true;
      blankReason = `Blank Page: No text content (${words} words). Auto-deleted.`;
    }
  }

  pageObj.is_blank = isBlank;
  pageObj.blank_reason = blankReason;
  pageObj.user_deleted = isBlank;
}

function reclassifyAllPages() {
  if (!pagesData || pagesData.length === 0) return;
  pagesData.forEach(p => evaluatePageClassification(p));
  renderPageGrid();
  updateSummaryStats();
}

function toggleAutoRotationSetting() {
  const enabled = document.getElementById("auto-rotate-toggle").checked;
  pagesData.forEach(p => {
    p.user_rotation = enabled ? p.suggested_rotation : 0;
  });
  renderPageGrid();
  updateSummaryStats();
}

function onScanCompleted() {
  const titleEl = document.getElementById("doc-title");
  if (titleEl) titleEl.innerText = currentFilename;

  const dropzoneEl = document.getElementById("dropzone");
  if (dropzoneEl) dropzoneEl.style.display = "none";

  const workspaceEl = document.getElementById("workspace");
  if (workspaceEl) workspaceEl.style.display = "block";

  const navBackBtn = document.getElementById("nav-back-btn");
  if (navBackBtn) navBackBtn.style.display = "inline-flex";

  const navRenameBtn = document.getElementById("nav-rename-btn");
  if (navRenameBtn) navRenameBtn.style.display = "inline-flex";

  renderPageGrid();
  updateSummaryStats();
  if (pagesData.length > 0) {
    inspectPage(0);
  }
}

function resetToUploadView() {
  pagesData = [];
  currentFilename = "Document.pdf";
  rawFileUint8Array = null;
  currentFileObject = null;
  mainCutIndices.clear();

  const fileInput = document.getElementById("file-input");
  if (fileInput) fileInput.value = "";

  const workspace = document.getElementById("workspace");
  if (workspace) workspace.style.display = "none";

  const dropzone = document.getElementById("dropzone");
  if (dropzone) dropzone.style.display = "block";

  const bottomBar = document.getElementById("bottom-action-bar");
  if (bottomBar) bottomBar.style.display = "none";

  const navBackBtn = document.getElementById("nav-back-btn");
  if (navBackBtn) navBackBtn.style.display = "none";

  const navRenameBtn = document.getElementById("nav-rename-btn");
  if (navRenameBtn) navRenameBtn.style.display = "none";

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateSummaryStats() {
  const total = pagesData.length;
  const autoRemovedBlank = pagesData.filter(p => p.is_blank && p.user_deleted).length;
  const autoRotated = pagesData.filter(p => p.user_rotation !== 0).length;
  const cleanOutput = pagesData.filter(p => !p.user_deleted).length;

  const elTotal = document.getElementById("stat-total");
  const elBlank = document.getElementById("stat-blank");
  const elRotated = document.getElementById("stat-rotated");
  const elActive = document.getElementById("stat-active");

  if (elTotal) elTotal.innerText = total;
  if (elBlank) elBlank.innerText = autoRemovedBlank;
  if (elRotated) elRotated.innerText = autoRotated;
  if (elActive) elActive.innerText = cleanOutput;

  // Filter Pill Badges
  const fAll = document.getElementById("filter-count-all");
  const fBlank = document.getElementById("filter-count-blank");
  const fRotated = document.getElementById("filter-count-rotated");
  const fActive = document.getElementById("filter-count-active");

  if (fAll) fAll.innerText = total;
  if (fBlank) fBlank.innerText = autoRemovedBlank;
  if (fRotated) fRotated.innerText = autoRotated;
  if (fActive) fActive.innerText = cleanOutput;

  // Floating Bottom Bar
  const bottomBar = document.getElementById("bottom-action-bar");
  const bottomText = document.getElementById("bottom-summary-text");
  const restorePill = document.getElementById("bottom-bar-restore-pill");

  if (bottomBar) {
    if (pagesData.length > 0) {
      if (!bottomBar.classList.contains("collapsed")) {
        bottomBar.style.display = "flex";
      }
      if (bottomText) bottomText.innerText = `${currentFilename} • ${cleanOutput} Clean Pages (${autoRemovedBlank} Blank Removed)`;
    } else {
      bottomBar.style.display = "none";
      if (restorePill) restorePill.style.display = "none";
    }
  }
}

function toggleBottomActionBar(show) {
  const bar = document.getElementById("bottom-action-bar");
  const pill = document.getElementById("bottom-bar-restore-pill");
  if (bar) {
    if (show) {
      bar.classList.remove("collapsed");
      bar.style.display = "flex";
      if (pill) pill.style.display = "none";
    } else {
      bar.classList.add("collapsed");
      if (pill) pill.style.display = "flex";
    }
  }
}

function setPageFilter(filterType, btnEl) {
  if (btnEl) {
    document.querySelectorAll('.filter-pill-btn').forEach(b => b.classList.remove('active'));
    btnEl.classList.add('active');
  }

  const selectEl = document.getElementById("page-filter");
  if (selectEl) selectEl.value = filterType;

  renderPageGrid();
}

// RENDER PDF24 TOOLBOX STYLE THUMBNAIL CARDS GRID WITH PROMINENT ZOOM BADGE ON EACH CARD
function renderPageGrid() {
  const filterSelect = document.getElementById("page-filter");
  const filter = filterSelect ? filterSelect.value : "all";
  const gridContainer = document.getElementById("page-grid");
  if (!gridContainer) return;

  gridContainer.innerHTML = "";

  const filteredPages = pagesData.filter(p => {
    if (filter === "blank") return p.is_blank;
    if (filter === "rotated") return p.needs_rotation || p.user_rotation !== 0;
    if (filter === "active") return !p.user_deleted;
    return true;
  });

  if (filteredPages.length === 0) {
    gridContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">No pages match the selected filter criteria.</div>`;
    return;
  }

  filteredPages.forEach((p, idx) => {
    const isSelected = p.page_index === currentInspectIndex;
    const card = document.createElement("div");
    card.className = `pdf24-page-card ${p.user_deleted ? 'deleted' : ''} ${isSelected ? 'selected-inspect' : ''}`;
    card.onclick = () => inspectPage(p.page_index);

    let statusBadgeHtml = '';
    if (p.user_deleted) {
      statusBadgeHtml = `<div class="pdf24-status-badge pdf24-status-blank">BLANK</div>`;
    } else if (p.user_rotation !== 0) {
      statusBadgeHtml = `<div class="pdf24-status-badge pdf24-status-rotated">${p.user_rotation}°</div>`;
    }

    card.innerHTML = `
      <!-- PDF24 Top Right Page Number -->
      <div class="pdf24-page-num">${p.page_num}</div>

      <!-- Top Right Discrete Zoom Icon -->
      <button class="pdf24-card-zoom-icon" onclick="event.stopPropagation(); currentInspectIndex = ${p.page_index}; openPageZoomModal();" title="Inspect Page ${p.page_num}">🔍</button>

      <!-- Top Left Status Badge if Blank or Rotated -->
      ${statusBadgeHtml}

      <!-- Document Image Canvas -->
      <div class="pdf24-canvas-box">
        <img src="${p.thumbnail_url}" style="transform: rotate(${p.user_rotation}deg);" alt="Page ${p.page_num}">
      </div>

      <!-- Hover Action Toolbar -->
      <div class="pdf24-hover-bar">
        <button class="pdf24-action-btn" onclick="event.stopPropagation(); rotatePage(${p.page_index}, -90)" title="Rotate Left 90°">↶ 90°</button>
        <button class="pdf24-action-btn" onclick="event.stopPropagation(); rotatePage(${p.page_index}, 90)" title="Rotate Right 90°">↷ 90°</button>
        <button class="pdf24-action-btn" onclick="event.stopPropagation(); currentInspectIndex = ${p.page_index}; openPageZoomModal();" title="Inspect Page ${p.page_num} Fullscreen">🔍</button>
        <button class="pdf24-action-btn ${p.user_deleted ? 'pdf24-btn-keep' : 'pdf24-btn-del'}" onclick="event.stopPropagation(); toggleDeletePage(${p.page_index})" title="${p.user_deleted ? 'Restore Page' : 'Remove Page'}">
          ${p.user_deleted ? '↩️ Keep' : '🗑️ Del'}
        </button>
      </div>
    `;

    gridContainer.appendChild(card);

    // PDF24 VERTICAL SCISSOR CUT DIVIDER BETWEEN CARDS (Visible ONLY when Split Mode is Active)
    if (isSplitModeEnabled && idx < filteredPages.length - 1) {
      const isCut = mainCutIndices.has(p.page_index);
      const scissorCol = document.createElement("div");
      scissorCol.className = `pdf24-scissor-col ${isCut ? 'is-cut' : ''}`;
      scissorCol.title = isCut ? "Click to remove split cut" : `Click scissor ✂️ to split PDF after Page ${p.page_num}`;
      scissorCol.onclick = (e) => {
        e.stopPropagation();
        toggleMainScissorCut(p.page_index);
      };

      scissorCol.innerHTML = `
        <div class="pdf24-scissor-line"></div>
        <button class="pdf24-scissor-btn" type="button" title="Split Cut">✂️</button>
      `;
      gridContainer.appendChild(scissorCol);
    }
  });
}

function inspectPage(pageIndex) {
  if (pageIndex < 0 || pageIndex >= pagesData.length) return;
  currentInspectIndex = pageIndex;
  const p = pagesData[pageIndex];

  renderPageGrid();

  const titleEl = document.getElementById("inspect-page-title");
  if (titleEl) titleEl.innerText = `Page ${p.page_num}`;

  const badgeEl = document.getElementById("inspect-status-badge");
  if (badgeEl) {
    if (p.user_deleted) {
      badgeEl.className = "status-badge status-badge-blank";
      badgeEl.innerText = "FLAGGED BLANK";
    } else if (p.user_rotation !== 0) {
      badgeEl.className = "status-badge status-badge-rotated";
      badgeEl.innerText = `ROTATED ${p.user_rotation}°`;
    } else {
      badgeEl.className = "status-badge status-badge-kept";
      badgeEl.innerText = "ACTIVE KEEP";
    }
  }

  const inkValEl = document.getElementById("inspect-ink-val");
  const inkBarEl = document.getElementById("inspect-ink-bar");
  if (inkValEl) inkValEl.innerText = `${p.dark_pixel_ratio ? p.dark_pixel_ratio.toFixed(2) : '0.0'}%`;
  if (inkBarEl) inkBarEl.style.width = `${Math.min((p.dark_pixel_ratio || 0) * 10, 100)}%`;

  const rotValEl = document.getElementById("inspect-rotation-val");
  if (rotValEl) rotValEl.innerText = `${p.user_rotation}° ${p.user_rotation === 0 ? '(Upright)' : ''}`;

  const classValEl = document.getElementById("inspect-classifier-val");
  if (classValEl) classValEl.innerText = p.word_count > 0 ? `${p.word_count} Digital Words` : `${p.active_tiles || 0} Spatial Ink Tiles`;

  // Update Right Inspector Prev / Next Navigation Buttons
  const isFirst = (currentInspectIndex <= 0);
  const isLast = (currentInspectIndex >= pagesData.length - 1);

  const insPrevBtn = document.getElementById("inspect-prev-btn");
  const insNextBtn = document.getElementById("inspect-next-btn");
  const insPrevFloat = document.getElementById("inspect-nav-prev-float");
  const insNextFloat = document.getElementById("inspect-nav-next-float");

  if (insPrevBtn) insPrevBtn.disabled = isFirst;
  if (insNextBtn) insNextBtn.disabled = isLast;
  if (insPrevFloat) insPrevFloat.disabled = isFirst;
  if (insNextFloat) insNextFloat.disabled = isLast;

  const inspectCanvas = document.getElementById("inspect-canvas");
  if (inspectCanvas) {
    const ctx = inspectCanvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      inspectCanvas.width = img.width;
      inspectCanvas.height = img.height;
      ctx.clearRect(0, 0, inspectCanvas.width, inspectCanvas.height);
      ctx.drawImage(img, 0, 0);
      applyInspectZoom();
    };
    img.src = p.thumbnail_url;
  }
}

function prevInspectPage() {
  if (currentInspectIndex > 0) {
    inspectPage(currentInspectIndex - 1);
  }
}

function nextInspectPage() {
  if (currentInspectIndex < pagesData.length - 1) {
    inspectPage(currentInspectIndex + 1);
  }
}

// INTERACTIVE PAGE READER ZOOM CONTROLS
function adjustInspectZoom(delta) {
  inspectZoomScale += delta;
  if (inspectZoomScale < 0.5) inspectZoomScale = 0.5;
  if (inspectZoomScale > 3.5) inspectZoomScale = 3.5;
  applyInspectZoom();
}

function resetInspectZoom() {
  inspectZoomScale = 1.0;
  applyInspectZoom();
}

function applyInspectZoom() {
  const canvas = document.getElementById("inspect-canvas");
  const badge = document.getElementById("inspect-zoom-level");
  if (canvas) {
    canvas.style.transform = `scale(${inspectZoomScale})`;
    canvas.style.transformOrigin = "top center";
  }
  if (badge) {
    badge.innerText = `${Math.round(inspectZoomScale * 100)}%`;
  }
}

function adjustModalZoom(delta) {
  modalZoomScale += delta;
  if (modalZoomScale < 0.5) modalZoomScale = 0.5;
  if (modalZoomScale > 4.5) modalZoomScale = 4.5;
  applyModalZoom();
}

function setModalZoomPreset(scale) {
  modalZoomScale = scale;
  applyModalZoom();
}

function resetModalZoom() {
  modalZoomScale = 1.0;
  applyModalZoom();
}

function applyModalZoom() {
  const canvas = document.getElementById("zoom-modal-canvas");
  const badge = document.getElementById("modal-zoom-level");
  if (canvas) {
    canvas.style.transform = `scale(${modalZoomScale})`;
    canvas.style.transformOrigin = "top center";
  }
  if (badge) {
    badge.innerText = `${Math.round(modalZoomScale * 100)}%`;
  }
}

function rotatePage(pageIndex, deg) {
  if (pagesData[pageIndex]) {
    pagesData[pageIndex].user_rotation = (pagesData[pageIndex].user_rotation + deg + 360) % 360;
    renderPageGrid();
    updateSummaryStats();
    if (pageIndex === currentInspectIndex) inspectPage(pageIndex);
  }
}

function rotateCurrentInspectPage(deg) {
  rotatePage(currentInspectIndex, deg);
}

function toggleDeletePage(pageIndex) {
  if (pagesData[pageIndex]) {
    pagesData[pageIndex].user_deleted = !pagesData[pageIndex].user_deleted;
    renderPageGrid();
    updateSummaryStats();
    if (pageIndex === currentInspectIndex) inspectPage(pageIndex);
  }
}

function toggleCurrentInspectPageDelete() {
  toggleDeletePage(currentInspectIndex);
}

function fixAllRotations() {
  pagesData.forEach(p => {
    if (p.needs_rotation) {
      p.user_rotation = p.suggested_rotation;
    }
  });
  renderPageGrid();
  updateSummaryStats();
  if (pagesData.length > 0) inspectPage(currentInspectIndex);
}

function deleteAllBlankPages() {
  pagesData.forEach(p => {
    if (p.is_blank) {
      p.user_deleted = true;
    }
  });
  renderPageGrid();
  updateSummaryStats();
  if (pagesData.length > 0) inspectPage(currentInspectIndex);
}

function restoreAllPages() {
  pagesData.forEach(p => {
    p.user_deleted = false;
  });
  renderPageGrid();
  updateSummaryStats();
  if (pagesData.length > 0) inspectPage(currentInspectIndex);
}

// Modal Handlers
function openModal(id) {
  if (id === "zoom-modal") {
    const card = document.getElementById("main-renamer-card");
    const modalSlot = document.getElementById("modal-renamer-slot");
    if (card && modalSlot) {
      modalSlot.appendChild(card);
    }
  }
  const modal = document.getElementById(id);
  if (modal) modal.classList.add("active");
  updateAllPreviews();
}

function closeModal(id) {
  if (id === "zoom-modal" || !id) {
    const card = document.getElementById("main-renamer-card");
    const sidebarSlot = document.getElementById("sidebar-renamer-slot");
    if (card && sidebarSlot) {
      sidebarSlot.appendChild(card);
    }
  }
  if (id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove("active");
  } else {
    document.querySelectorAll('.modal-overlay').forEach(m => {
      if (m.id === "zoom-modal") {
        const card = document.getElementById("main-renamer-card");
        const sidebarSlot = document.getElementById("sidebar-renamer-slot");
        if (card && sidebarSlot) sidebarSlot.appendChild(card);
      }
      m.classList.remove("active");
    });
  }
  updateAllPreviews();
}

function openHelpModal() {
  openModal("help-modal");
}

function openInstallModal() {
  openModal("install-modal");
}

// WIDESCREEN FULLPAGE ZOOM READER & LIVE RENAMER MODAL (Ultra-HD 4K Vector Scale)
async function openPageZoomModal() {
  const p = pagesData[currentInspectIndex];
  if (!p) return;

  modalZoomScale = 1.0;
  const titleEl = document.getElementById("zoom-modal-title");
  if (titleEl) titleEl.innerText = `Page ${p.page_num} of ${pagesData.length} - Reader & Live Renamer (${p.user_rotation}° Upright)`;

  // Update Status Badge & Remove/Restore Button in Modal Header
  const badgeEl = document.getElementById("zoom-modal-status-badge");
  const toggleDelBtn = document.getElementById("zoom-modal-toggle-del-btn");

  if (badgeEl) {
    if (p.user_deleted) {
      badgeEl.className = "status-badge status-badge-blank";
      badgeEl.innerText = "FLAGGED BLANK";
    } else {
      badgeEl.className = "status-badge status-badge-kept";
      badgeEl.innerText = "ACTIVE KEEP";
    }
  }

  if (toggleDelBtn) {
    if (p.user_deleted) {
      toggleDelBtn.className = "btn btn-success btn-sm";
      toggleDelBtn.innerText = "↩️ Restore Page";
    } else {
      toggleDelBtn.className = "btn btn-danger btn-sm";
      toggleDelBtn.innerText = "🗑️ Remove Page";
    }
  }

  // Sync Live Renamer inputs to current extracted metadata
  updateSmartRenameUI();

  // Update Page Navigation Controls (Toolbar & Floating Side Arrows)
  const isFirst = (currentInspectIndex <= 0);
  const isLast = (currentInspectIndex >= pagesData.length - 1);

  const prevBtn = document.getElementById("zoom-modal-prev-btn");
  const nextBtn = document.getElementById("zoom-modal-next-btn");
  const prevFloat = document.getElementById("zoom-nav-prev-float");
  const nextFloat = document.getElementById("zoom-nav-next-float");

  if (prevBtn) prevBtn.disabled = isFirst;
  if (nextBtn) nextBtn.disabled = isLast;
  if (prevFloat) prevFloat.disabled = isFirst;
  if (nextFloat) nextFloat.disabled = isLast;

  const canvas = document.getElementById("zoom-modal-canvas");
  if (!canvas) return;

  // Render high-res direct PDF page using PDF.js at 4.0 Ultra-HD 4K Scale
  if (rawFileUint8Array && window.pdfjsLib) {
    try {
      showLoading("Rendering 4K Ultra-HD Crisp Page Reader...");
      const loadingTask = pdfjsLib.getDocument({ data: rawFileUint8Array.slice() });
      const pdfDoc = await loadingTask.promise;
      const pdfPage = await pdfDoc.getPage(p.page_num);
      
      // Render scale 4.0 for razor-sharp vector clarity on laptops & small screens
      const viewport = pdfPage.getViewport({ scale: 4.0, rotation: p.user_rotation });
      const ctx = canvas.getContext("2d");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      await pdfPage.render({ canvasContext: ctx, viewport: viewport }).promise;
      applyModalZoom();
      hideLoading();
      openModal("zoom-modal");
      return;
    } catch (e) {
      console.log("PDF.js high-res render fallback to thumbnail image:", e);
    }
  }

  // Fallback Image Render
  const ctx = canvas.getContext("2d");
  const img = new Image();
  img.onload = () => {
    canvas.width = img.width * 3;
    canvas.height = img.height * 3;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((p.user_rotation * Math.PI) / 180);
    ctx.drawImage(img, -img.width * 1.5, -img.height * 1.5, img.width * 3, img.height * 3);
    ctx.restore();

    applyModalZoom();
    openModal("zoom-modal");
  };
  img.src = p.thumbnail_url;
}

function prevInspectPageModal() {
  if (currentInspectIndex > 0) {
    currentInspectIndex--;
    openPageZoomModal();
  }
}

function nextInspectPageModal() {
  if (currentInspectIndex < pagesData.length - 1) {
    currentInspectIndex++;
    openPageZoomModal();
  }
}

function toggleModalPageDelete() {
  if (currentInspectIndex < 0 || currentInspectIndex >= pagesData.length) return;
  toggleDeletePage(currentInspectIndex);
  openPageZoomModal();
}

// Global Keyboard Navigation (ArrowLeft / ArrowRight) for Zoom Reader & Page Inspector
document.addEventListener("keydown", (e) => {
  const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : "";
  if (activeTag === "input" || activeTag === "textarea" || activeTag === "select") return;

  const modal = document.getElementById("zoom-modal");
  if (modal && modal.classList.contains("active")) {
    if (e.key === "ArrowLeft") {
      prevInspectPageModal();
    } else if (e.key === "ArrowRight") {
      nextInspectPageModal();
    }
  } else if (pagesData && pagesData.length > 0) {
    if (e.key === "ArrowLeft") {
      prevInspectPage();
    } else if (e.key === "ArrowRight") {
      nextInspectPage();
    }
  }
});

// IndexedDB Directory Handle Persistence Helpers
const DIR_DB_NAME = "pdf_cleanspace_db";
const DIR_STORE_NAME = "directory_handles";

function openDirDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DIR_DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(DIR_STORE_NAME)) {
        db.createObjectStore(DIR_STORE_NAME);
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

async function storeDirectoryHandle(handle) {
  try {
    const db = await openDirDB();
    const tx = db.transaction(DIR_STORE_NAME, "readwrite");
    tx.objectStore(DIR_STORE_NAME).put(handle, "baseDirHandle");
  } catch (e) {
    console.log("IndexedDB store handle error:", e);
  }
}

async function getStoredDirectoryHandle() {
  try {
    const db = await openDirDB();
    return new Promise((resolve) => {
      const tx = db.transaction(DIR_STORE_NAME, "readonly");
      const req = tx.objectStore(DIR_STORE_NAME).get("baseDirHandle");
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}

let savedDirectoryHandle = null;

async function selectLocalBaseDirectory() {
  if ('showDirectoryPicker' in window) {
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      if (handle) {
        savedDirectoryHandle = handle;
        await storeDirectoryHandle(handle);
        const currentBase = getSavedBaseDir() || "D:\\RAILWAY";
        const textPath = prompt(`📁 Folder Selected: ${handle.name}\n\nEnter exact local disk target folder path (e.g. D:\\RAILWAY or C:\\Scans):`, currentBase);
        const cleanPath = (textPath && textPath.trim()) ? textPath.trim().replace(/^["']+|["']+$|\.lnk$/gi, '').replace(/\\$/, '') : `D:\\${handle.name}`;
        saveBaseDir(cleanPath);
        extractedMetadata.baseDir = cleanPath;
        const b1 = document.getElementById("rename-base-dir");
        if (b1) b1.value = cleanPath;
        updateAllPreviews();
        alert(`✓ Direct Folder Write Access Granted for ${cleanPath}!\n\nPDF files will now be saved directly inside your local disk folder structure!`);
        return;
      }
    } catch (e) {
      if (e.name === 'AbortError') return;
      console.log("Directory picker fallback to text input:", e);
    }
  }

  const currentBase = getSavedBaseDir() || "D:\\RAILWAY";
  const userFolder = prompt("📁 Enter your target Base Folder path for automatic PDF saving:\n\nExample: D:\\RAILWAY or C:\\Scans", currentBase);
  if (userFolder && userFolder.trim()) {
    const cleanPath = userFolder.trim().replace(/^["']+|["']+$|\.lnk$/gi, '').replace(/\\$/, '');
    saveBaseDir(cleanPath);
    extractedMetadata.baseDir = cleanPath;
    const b1 = document.getElementById("rename-base-dir");
    if (b1) b1.value = cleanPath;
    updateAllPreviews();
  }
}

// Export Cleaned PDF File with 1-Click Auto Save OR Manual Folder Selection
async function exportCleanedPdf(saveMode = 'auto') {
  if (!pagesData || pagesData.length === 0) {
    alert("Please upload a PDF document first.");
    return;
  }

  const activePages = pagesData.filter(p => !p.user_deleted);
  if (activePages.length === 0) {
    alert("⚠️ All pages are marked for removal! Restore at least 1 page before downloading.");
    return;
  }

  // Sync DOM sidebar input fields to extractedMetadata first to ensure user edits are preserved
  onRenameMetadataChanged();

  // Check if split mode is active with scissor cuts placed
  let currentPartActivePages = activePages;
  let currentPartAllPages = pagesData;
  let firstCutIndex = -1;
  let isSplitRun = false;
  let totalPartsCount = 1;

  if (isSplitModeEnabled && mainCutIndices.size > 0) {
    const cutIndicesArr = Array.from(mainCutIndices).sort((a, b) => a - b);
    firstCutIndex = cutIndicesArr[0];
    isSplitRun = true;
    totalPartsCount = cutIndicesArr.length + 1;

    currentPartAllPages = pagesData.filter(p => p.page_index <= firstCutIndex);
    currentPartActivePages = currentPartAllPages.filter(p => !p.user_deleted);

    if (currentPartActivePages.length === 0) {
      alert(`⚠️ Part 1 (Pages 1 to ${firstCutIndex + 1}) has no active pages. Please unmark at least 1 page or adjust split cut position.`);
      return;
    }
  }

  const partLabel = isSplitRun ? `Part 1 of ${totalPartsCount} (Pages 1 to ${firstCutIndex + 1})` : "cleaned PDF document";
  showLoading(`Generating ${partLabel}...`);

  try {
    let pdfBuffer = null;
    if (currentFileObject) {
      pdfBuffer = await currentFileObject.arrayBuffer();
    } else if (rawFileUint8Array) {
      pdfBuffer = rawFileUint8Array.buffer;
    }

    if (!pdfBuffer) throw new Error("Source PDF buffer not found.");

    const srcPdfDoc = await PDFLib.PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
    const newPdf = await PDFLib.PDFDocument.create();

    const pageIndicesToCopy = currentPartActivePages.map(p => (p.original_index !== undefined) ? p.original_index : p.page_index);
    const copiedPages = await newPdf.copyPages(srcPdfDoc, pageIndicesToCopy);

    copiedPages.forEach((page, copyIdx) => {
      const origPageData = currentPartActivePages[copyIdx];
      if (origPageData.user_rotation !== 0) {
        const existingRot = page.getRotation().angle;
        page.setRotation(PDFLib.degrees((existingRot + origPageData.user_rotation) % 360));
      }
      newPdf.addPage(page);
    });

    const pdfBytes = await newPdf.save();

    // Helper to convert Uint8Array to base64
    let binary = '';
    const bytes = new Uint8Array(pdfBytes);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64Data = window.btoa(binary);

    // Read exact target disk folder path and filename from DOM preview/input
    generateTargetPathAndFilename();
    const folderPathPreview = document.getElementById("rename-folder-path-preview");
    const modalFolderPathPreview = document.getElementById("modal-folder-path-preview");
    const outputEl = document.getElementById("rename-output-filename");

    let exportName = outputEl ? outputEl.value.trim() : "";
    if (!exportName) {
      const rawCat = extractedMetadata.category || "Employee";
      const catPrefix = rawCat.toLowerCase().substring(0, 3);
      const cleanName = (extractedMetadata.personName || "record").toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/[\s-]+/g, '-');
      const rawGender = extractedMetadata.gender || "Female";
      const genderCode = rawGender.trim().toUpperCase().startsWith("M") ? "M" : (rawGender.trim().toUpperCase().startsWith("F") ? "F" : "O");
      const ageDigits = extractedMetadata.age ? String(extractedMetadata.age).trim().replace(/\D/g, '') : "0";
      const rawRef = extractedMetadata.refNo || "";
      const refDigits = rawRef.replace(/\D/g, '') || rawRef.toLowerCase().trim().replace(/[^a-z0-9]/g, '') || "0";
      const parsedDate = parseRecordDate(extractedMetadata.recordDate);
      const yearYY = parsedDate.yearStr.slice(-2);
      const formattedDateYY = `${parsedDate.dayStr}-${parsedDate.monthNumStr}-${yearYY}`;
      exportName = `${catPrefix}_${cleanName}_${genderCode}_${ageDigits}_${refDigits}_${formattedDateYY}.pdf`;
    }
    if (!exportName.toLowerCase().endsWith(".pdf")) exportName += ".pdf";

    let folderPath = "";
    if (modalFolderPathPreview && modalFolderPathPreview.innerText.trim() && !modalFolderPathPreview.innerText.includes("[Set Base Folder]")) {
      folderPath = modalFolderPathPreview.innerText.trim();
    } else if (folderPathPreview && folderPathPreview.innerText.trim() && !folderPathPreview.innerText.includes("[Set Base Folder]")) {
      folderPath = folderPathPreview.innerText.trim();
    }

    if (!folderPath || folderPath.includes("[Set Base Folder]")) {
      let savedBase = getSavedBaseDir();
      if (!savedBase) {
        hideLoading();
        const userFolder = prompt("⚠️ Target Base Folder is not set for this device.\n\nPlease enter your local Base Folder path once (e.g. C:\\Scans or D:\\Scan):", "C:\\Scans");
        if (userFolder && userFolder.trim()) {
          savedBase = userFolder.trim().replace(/\\$/, '');
          saveBaseDir(savedBase);
          extractedMetadata.baseDir = savedBase;
          const b1 = document.getElementById("rename-base-dir");
          const b2 = document.getElementById("modal-base-dir");
          if (b1) b1.value = savedBase;
          if (b2) b2.value = savedBase;
          showLoading(`Generating ${partLabel}...`);
        } else {
          alert("⚠️ Auto-save paused. Base folder path is required to save PDF files directly.");
          return;
        }
      } else {
        extractedMetadata.baseDir = savedBase;
        const b1 = document.getElementById("rename-base-dir");
        const b2 = document.getElementById("modal-base-dir");
        if (b1) b1.value = savedBase;
        if (b2) b2.value = savedBase;
      }
      generateTargetPathAndFilename();
      const fpEl = document.getElementById("modal-folder-path-preview") || document.getElementById("rename-folder-path-preview");
      if (fpEl) folderPath = fpEl.innerText.trim();
    }

    // Sanitize folder path to guarantee no leftover placeholder and clean backslashes
    folderPath = folderPath.replace(/\[Set Base Folder\]/gi, '').trim();
    folderPath = folderPath.replace(/[/\\]+/g, '\\');
    if (!folderPath.endsWith('\\')) folderPath += '\\';

    const fullTargetPath = `${folderPath}${exportName}`;

    // Helper to remove saved part pages and move to next part
    const finalizePartSaved = (savedPath) => {
      if (isSplitRun) {
        const remainingAllPages = pagesData.filter(p => p.page_index > firstCutIndex);
        const numPart1Pages = currentPartAllPages.length;

        // Shift remaining pages indices
        remainingAllPages.forEach((p, idx) => {
          p.page_index = idx;
          p.page_num = idx + 1;
        });

        // Shift remaining cut indices
        const updatedCuts = new Set();
        mainCutIndices.forEach(cutIdx => {
          if (cutIdx > firstCutIndex) {
            updatedCuts.add(cutIdx - numPart1Pages);
          }
        });

        pagesData = remainingAllPages;
        mainCutIndices = updatedCuts;

        if (outputEl) delete outputEl.dataset.userEdited;

        updateSplitButtonsUI();
        renderPageGrid();

        if (pagesData.length > 0) {
          const nextPartText = pagesData.map(p => p.extracted_text || "").join(" ") || fullExtractedText;
          if (nextPartText) {
            extractDocumentMetadata(nextPartText);
          }
          alert(`✓ Part 1 saved successfully!\n\nSaved Target Path:\n${savedPath}\n\n✂️ Part 1 pages removed from workspace.\nNow reviewing Part 2 (${pagesData.length} pages remaining).\nCheck or edit Part 2's category, folder path & filename in sidebar, then click Save for Part 2.`);
        } else {
          alert(`✓ Part 1 saved successfully!\n\nSaved Target Path:\n${savedPath}\n\n🎉 All split parts have been saved successfully!`);
        }
      } else {
        alert(`✓ PDF file automatically saved directly to target folder!\n\nSaved Target Path:\n${savedPath}`);
      }
    };

    // MODE 1: 1-Click Direct Auto Save (ZERO POPUPS / DIRECT DISK WRITE)
    if (saveMode === 'auto') {
      // Option A: Try local Node server endpoints (/api/save-to-disk) if running desktop app
      const endpoints = [
        "/api/save-to-disk",
        "http://localhost:8000/api/save-to-disk",
        "http://127.0.0.1:8000/api/save-to-disk",
        "http://localhost:3000/api/save-to-disk"
      ];

      for (const endpoint of endpoints) {
        try {
          const apiRes = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              targetPath: fullTargetPath,
              pdfBase64: base64Data
            })
          });

          if (apiRes.ok) {
            const result = await apiRes.json();
            if (result && result.success) {
              hideLoading();
              finalizePartSaved(result.savedPath);
              return;
            }
          }
        } catch (e) {
          // Endpoint unavailable, try next endpoint in chain
        }
      }

      // Option B: Try File System Directory Handle write (if user picked base folder in browser)
      if (!savedDirectoryHandle) {
        savedDirectoryHandle = await getStoredDirectoryHandle();
      }

      if (savedDirectoryHandle) {
        try {
          if (savedDirectoryHandle.queryPermission) {
            let perm = await savedDirectoryHandle.queryPermission({ mode: 'readwrite' });
            if (perm !== 'granted') {
              perm = await savedDirectoryHandle.requestPermission({ mode: 'readwrite' });
            }
            if (perm !== 'granted') throw new Error("Folder permission not granted");
          }

          const parsedDate = parseRecordDate(extractedMetadata.recordDate);
          const rawCat = extractedMetadata.category || "Employee";
          const folderParts = [rawCat, parsedDate.yearStr, parsedDate.monthNameStr, parsedDate.dayStr];

          let currHandle = savedDirectoryHandle;
          for (const part of folderParts) {
            currHandle = await currHandle.getDirectoryHandle(part, { create: true });
          }

          const fileHandle = await currHandle.getFileHandle(exportName, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(pdfBytes);
          await writable.close();

          hideLoading();
          finalizePartSaved(fullTargetPath);
          return;
        } catch (err) {
          console.log("Directory handle write failed:", err);
        }
      }

      // Option C: Browser Blob Download Fallback with Direct Disk Guidance
      hideLoading();
      const pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });
      downloadBlob(pdfBlob, exportName);

      if (isSplitRun) {
        alert(`✓ Part 1 downloaded!\n\n📄 Downloaded to browser Downloads folder as:\n${exportName}\n\n💡 TO SAVE DIRECTLY INTO DISK FOLDER (${fullTargetPath}):\nClick the blue '📁 Browse' button beside Base Folder once to grant direct folder write access!`);
      } else {
        alert(`✓ PDF file generated!\n\n📄 File saved in browser Downloads folder as:\n${exportName}\n\n💡 TO SAVE DIRECTLY INTO DISK FOLDER (${fullTargetPath}) AUTOMATICALLY:\nPlease click the blue '📁 Browse' button beside Base Folder ONCE and select your folder (e.g. D:\\RAILWAY). Chrome will grant direct folder write access!`);
      }
      return;
    }

    // MODE 2: Manual Folder Selection & Browser Save Picker
    hideLoading();
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: exportName,
          types: [{
            description: `Cleaned ${extractedMetadata.category} PDF Document`,
            accept: { 'application/pdf': ['.pdf'] }
          }]
        });
        const writable = await handle.createWritable();
        await writable.write(pdfBytes);
        await writable.close();
        finalizePartSaved(fullTargetPath);
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }

    // Fallback direct blob download if window.showSaveFilePicker is not supported or cancelled
    const pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });
    downloadBlob(pdfBlob, exportName);
    finalizePartSaved(fullTargetPath);
  } catch (err) {
    hideLoading();
    alert("Export Error: " + err.message);
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// BATCH PROCESSING
function handleBatchSelect(event) {
  const files = Array.from(event.target.files).filter(f => f.name.toLowerCase().endsWith('.pdf'));
  if (files.length === 0) return;

  batchQueue = files.map(file => ({
    file: file,
    status: 'queued'
  }));

  const container = document.getElementById("batch-queue-container");
  const countEl = document.getElementById("batch-queue-count");
  if (container) container.style.display = "block";
  if (countEl) countEl.innerText = `Queue (${batchQueue.length} Files)`;

  renderBatchQueue();
}

function renderBatchQueue() {
  const listEl = document.getElementById("batch-queue-list");
  if (!listEl) return;
  listEl.innerHTML = "";

  batchQueue.forEach((item) => {
    const div = document.createElement("div");
    div.className = "batch-item-card";
    div.innerHTML = `
      <div>
        <div style="font-weight: 700; color: var(--text-main);">${item.file.name}</div>
        <div style="font-size: 0.78rem; color: var(--text-muted);">${(item.file.size / (1024 * 1024)).toFixed(2)} MB</div>
      </div>
      <span class="status-badge status-badge-kept">${item.status.toUpperCase()}</span>
    `;
    listEl.appendChild(div);
  });
}

async function runBatchProcessing() {
  if (batchQueue.length === 0) return;
  for (let i = 0; i < batchQueue.length; i++) {
    const item = batchQueue[i];
    item.status = "processing";
    renderBatchQueue();
    await uploadPdfFile(item.file);
    await exportCleanedPdf('auto');
    item.status = "done";
    renderBatchQueue();
  }
  alert("✓ Batch processing completed!");
}

// PDF VIEWER
let currentViewerScale = 1.0;
function viewerZoom(delta) {
  currentViewerScale += delta;
  if (currentViewerScale < 0.5) currentViewerScale = 0.5;
  if (currentViewerScale > 3.0) currentViewerScale = 3.0;

  const badge = document.getElementById("viewer-zoom-val");
  if (badge) badge.innerText = `${Math.round(currentViewerScale * 100)}%`;
  initPdfViewer();
}

async function initPdfViewer() {
  const container = document.getElementById("viewer-container");
  if (!container) return;

  if (!rawFileUint8Array) {
    container.innerHTML = `<div style="color: var(--text-muted); margin-top: 3rem;">Upload a PDF document to view it in high-resolution continuous scroll mode.</div>`;
    return;
  }

  try {
    const loadingTask = pdfjsLib.getDocument({ data: rawFileUint8Array.slice() });
    const pdfDoc = await loadingTask.promise;

    container.innerHTML = "";
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale: currentViewerScale });
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.boxShadow = "0 10px 30px rgba(0,0,0,0.5)";
      canvas.style.borderRadius = "8px";

      container.appendChild(canvas);
      await page.render({ canvasContext: ctx, viewport: viewport }).promise;
    }
  } catch (err) {
    container.innerHTML = `<div style="color: var(--danger);">Failed rendering viewer: ${err.message}</div>`;
  }
}

// PWA Installation Handler with Zero Alert Text Boxes & Visual Address Bar Guidance
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

async function triggerPwaPrompt() {
  if (deferredPrompt) {
    try {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult && choiceResult.outcome === 'accepted') {
        deferredPrompt = null;
        closeModal('install-modal');
        return;
      }
    } catch (e) {
      console.log("PWA prompt error:", e);
    }
  }

  // Update modal card content directly (NO ALERT TEXT POPUP BOXES)
  const modalContent = document.getElementById("install-modal-content");
  if (modalContent) {
    modalContent.innerHTML = `
      <button class="modal-close-btn" onclick="closeModal('install-modal')">✕</button>
      <div style="text-align: center; padding: 0.5rem 0;">
        <div style="font-size: 2.2rem; margin-bottom: 0.5rem;">↗️ 🖥️</div>
        <h3 style="font-size: 1.1rem; font-weight: 800; color: #0f172a; margin-bottom: 0.5rem;">
          Click the Install Icon in your Chrome Address Bar!
        </h3>
        <p style="font-size: 0.82rem; color: #475569; font-weight: 600; line-height: 1.45; margin-bottom: 1rem;">
          Google Chrome has already placed the <strong>Install App Icon [↓]</strong> directly on the top-right of your address bar!
        </p>
        <div style="background: #f1f5f9; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 0.75rem; font-size: 0.8rem; font-weight: 700; color: #1e293b; text-align: left; margin-bottom: 1rem; line-height: 1.5;">
          📍 <strong>Look at the top-right of your screen:</strong><br>
          1. Right next to the URL <code>pdf-cleanspace-studio.vercel.app</code>, click the computer icon <strong>[↓]</strong>.<br>
          2. OR click Chrome top menu (three dots <strong>⋮</strong>) ➔ <strong>Save and Share / Install App</strong>.
        </div>
        <button class="btn btn-secondary" onclick="closeModal('install-modal')" style="width: 100%; font-weight: 800;">
          OK, Got It!
        </button>
      </div>
    `;
  }
}
