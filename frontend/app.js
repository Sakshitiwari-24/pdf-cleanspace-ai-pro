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
let isSplitModeEnabled = true;
let currentInspectIndex = 0;

let inspectZoomScale = 1.0;
let modalZoomScale = 1.0;

let extractedMetadata = {
  category: "Employee", // Employee | Family | Retired
  personName: "John Doe",
  gender: "Male",
  age: "35",
  refNo: "EMP-1092",
  recordDate: "2026-08-17",
  baseDir: "D:\\Scan"
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

    const pageObj = {
      page_num: i,
      page_index: i - 1,
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
  if (!extractedAge) extractedAge = "35";

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

  // 6. DATE EXTRACTION (Restricted to 2017 to 2030)
  let extractedDate = "";
  const dateMatch = text.match(/\b(201[7-9]|202[0-9]|2030)[/-](0[1-9]|1[0-2])[/-](0[1-9]|[12][0-9]|3[01])\b/) ||
                    text.match(/\b(0[1-9]|[12][0-9]|3[01])[/-](0[1-9]|1[0-2])[/-](201[7-9]|202[0-9]|2030)\b/);
  if (dateMatch) {
    extractedDate = dateMatch[0];
  } else {
    const d = new Date();
    extractedDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function getSavedBaseDir() {
  return localStorage.getItem("operator_base_dir") || "D:\\Scan";
}

function saveBaseDir(val) {
  if (val && val.trim()) {
    localStorage.setItem("operator_base_dir", val.trim());
  }
}

function extractPdfMetadataAndAutoFill(text) {
  // 1. CATEGORY DETECTION
  let detectedCategory = "Employee";
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes("pension") || lowerText.includes("retired") || lowerText.includes("ppo") || lowerText.includes("superannuation")) {
    detectedCategory = "Retired";
  } else if (lowerText.includes("family") || lowerText.includes("dependent") || lowerText.includes("spouse") || lowerText.includes("nominee")) {
    detectedCategory = "Family";
  } else if (lowerText.includes("employee") || lowerText.includes("designation") || lowerText.includes("department") || lowerText.includes("salary")) {
    detectedCategory = "Employee";
  }

  // 2. NAME EXTRACTION
  let extractedName = "";
  const namePatterns = [
    /(?:name\s*:\s*|name\s+of\s+employee\s*:\s*|employee\s+name\s*:\s*)([A-Z\s]{3,30})/i,
    /(?:mr\.|mrs\.|ms\.|dr\.)\s+([A-Z\s]{3,25})/i,
    /([A-Z][a-z]+\s+[A-Z][a-z]+)/
  ];

  for (const pat of namePatterns) {
    const m = text.match(pat);
    if (m && m[1] && m[1].trim().length > 2) {
      extractedName = m[1].trim();
      break;
    }
  }

  // 3. GENDER EXTRACTION
  let extractedGender = "Male";
  if (/\b(female|woman|she|her|mrs\.|ms\.)\b/i.test(text)) {
    extractedGender = "Female";
  } else if (/\b(other|transgender)\b/i.test(text)) {
    extractedGender = "Other";
  }

  // 4. AGE EXTRACTION
  let extractedAge = "29";
  const ageMatch = text.match(/\b(?:age|years?|yrs?)\s*:\s*(\d{1,3})\b/i) || text.match(/\b(\d{2})\s*(?:years|yrs)\b/i);
  if (ageMatch) {
    extractedAge = ageMatch[1];
  }

  // 5. ID / REF NUMBER EXTRACTION
  let extractedId = "";
  const idPatterns = [
    /(?:emp\s*id|employee\s*code|ppo\s*no|ref\s*no|ref\s*id)\s*:\s*([A-Z0-9\-_]{3,20})/i,
    /\b(EMP-\d{4,8}|PPO-\d{4,8}|\d{6,10})\b/i
  ];

  for (const pat of idPatterns) {
    const m = text.match(pat);
    if (m && m[1] && m[1].trim().length >= 3) {
      extractedId = m[1].trim();
      break;
    }
  }

  // 6. DATE EXTRACTION (Restricted to 2017 to 2030)
  let extractedDate = "";
  const dateMatch = text.match(/\b(201[7-9]|202[0-9]|2030)[/-](0[1-9]|1[0-2])[/-](0[1-9]|[12][0-9]|3[01])\b/) ||
                    text.match(/\b(0[1-9]|[12][0-9]|3[01])[/-](0[1-9]|1[0-2])[/-](201[7-9]|202[0-9]|2030)\b/);
  if (dateMatch) {
    extractedDate = dateMatch[0];
  } else {
    const d = new Date();
    extractedDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  extractedMetadata = {
    category: detectedCategory,
    personName: extractedName || "nitin",
    gender: extractedGender,
    age: extractedAge,
    refNo: extractedId || "993561427",
    recordDate: extractedDate,
    baseDir: getSavedBaseDir()
  };

  updateSmartRenameUI();
}

function updateSmartRenameUI() {
  const catBadge = document.getElementById("rename-cat-badge");
  const catSelect = document.getElementById("rename-category");
  const nameInput = document.getElementById("rename-person-name");
  const genderSelect = document.getElementById("rename-gender");
  const ageInput = document.getElementById("rename-age");
  const idInput = document.getElementById("rename-ref-id");
  const datePicker = document.getElementById("rename-date-picker");
  const dateTyper = document.getElementById("rename-date-typer");
  const baseDirInput = document.getElementById("rename-base-dir");

  if (catSelect) catSelect.value = extractedMetadata.category;
  if (nameInput) nameInput.value = extractedMetadata.personName;
  if (genderSelect) genderSelect.value = extractedMetadata.gender;
  if (ageInput) ageInput.value = extractedMetadata.age;
  if (idInput) idInput.value = extractedMetadata.refNo;
  if (datePicker) datePicker.value = extractedMetadata.recordDate;
  if (dateTyper) dateTyper.value = extractedMetadata.recordDate;
  if (baseDirInput) baseDirInput.value = extractedMetadata.baseDir || getSavedBaseDir();

  if (catBadge) {
    catBadge.className = `cat-badge cat-badge-${extractedMetadata.category.toLowerCase()}`;
    if (extractedMetadata.category === "Employee") catBadge.innerText = "💼 EMPLOYEE";
    else if (extractedMetadata.category === "Family") catBadge.innerText = "👨‍👩‍👧 FAMILY";
    else if (extractedMetadata.category === "Retired") catBadge.innerText = "👵 RETIRED";
  }

  // Sync Modal inputs if present
  const modalName = document.getElementById("modal-person-name");
  const modalGender = document.getElementById("modal-gender");
  const modalAge = document.getElementById("modal-age");
  const modalId = document.getElementById("modal-ref-id");
  const modalPicker = document.getElementById("modal-date-picker");
  const modalTyper = document.getElementById("modal-date-typer");
  const modalBaseDir = document.getElementById("modal-base-dir");

  if (modalName) modalName.value = extractedMetadata.personName;
  if (modalGender) modalGender.value = extractedMetadata.gender;
  if (modalAge) modalAge.value = extractedMetadata.age;
  if (modalId) modalId.value = extractedMetadata.refNo;
  if (modalPicker) modalPicker.value = extractedMetadata.recordDate;
  if (modalTyper) modalTyper.value = extractedMetadata.recordDate;
  if (modalBaseDir) modalBaseDir.value = extractedMetadata.baseDir || getSavedBaseDir();

  const radioBtns = document.getElementsByName("modal-cat-radio");
  radioBtns.forEach(r => {
    r.checked = (r.value === extractedMetadata.category);
  });

  generateTargetPathAndFilename();
}

function syncDatePickerToTyper(val) {
  extractedMetadata.recordDate = val;
  const t1 = document.getElementById("rename-date-typer");
  const t2 = document.getElementById("modal-date-typer");
  if (t1) t1.value = val;
  if (t2) t2.value = val;
  onRenameMetadataChanged();
}

function syncDateTyperToPicker(val) {
  if (val.length >= 8) {
    const validMatch = val.match(/\b(201[7-9]|202[0-9]|2030)[/-](0[1-9]|1[0-2])[/-](0[1-9]|[12][0-9]|3[01])\b/);
    if (validMatch) {
      extractedMetadata.recordDate = val;
      const p1 = document.getElementById("rename-date-picker");
      const p2 = document.getElementById("modal-date-picker");
      if (p1) p1.value = val;
      if (p2) p2.value = val;
    }
  }
  extractedMetadata.recordDate = val;
  onRenameMetadataChanged();
}

function onRenameMetadataChanged() {
  const catSelect = document.getElementById("rename-category");
  const nameInput = document.getElementById("rename-person-name");
  const genderSelect = document.getElementById("rename-gender");
  const ageInput = document.getElementById("rename-age");
  const idInput = document.getElementById("rename-ref-id");
  const baseDirInput = document.getElementById("rename-base-dir");

  if (catSelect) extractedMetadata.category = catSelect.value;
  if (nameInput) extractedMetadata.personName = nameInput.value.trim();
  if (genderSelect) extractedMetadata.gender = genderSelect.value;
  if (ageInput) extractedMetadata.age = ageInput.value.trim();
  if (idInput) extractedMetadata.refNo = idInput.value.trim();
  if (baseDirInput) {
    extractedMetadata.baseDir = baseDirInput.value.trim();
    saveBaseDir(extractedMetadata.baseDir);
  }

  generateTargetPathAndFilename();
}

// EXACT USER SCHEMA FILENAME GENERATOR (emp_nitin-993561427_m_29_20-11-2022.pdf)
function generateTargetPathAndFilename() {
  const rawCat = extractedMetadata.category || "Employee";
  // 1. First 3 letters of category (emp, fam, ret)
  const catPrefix = rawCat.toLowerCase().substring(0, 3);

  // 2. Name - clean lowercase
  const rawName = (extractedMetadata.personName || "record").toLowerCase().trim().replace(/\s+/g, '-');

  // 3. Ref Number - extract digits only if present, or clean string
  const rawRef = extractedMetadata.refNo || "";
  const refDigits = rawRef.replace(/\D/g, '') || rawRef.toLowerCase().replace(/\s+/g, '-');
  const nameRefPart = refDigits ? `${rawName}-${refDigits}` : rawName;

  // 4. Gender (m, f, o)
  const rawGender = (extractedMetadata.gender || "Male").toLowerCase();
  let genderCode = "m";
  if (rawGender.startsWith("f")) genderCode = "f";
  else if (rawGender.startsWith("o")) genderCode = "o";

  // 5. Age
  const ageStr = extractedMetadata.age ? String(extractedMetadata.age).trim() : "0";

  // 6. Date formatting to DD-MM-YYYY
  const rawDate = extractedMetadata.recordDate || "2026-08-17";
  let dayStr = "17";
  let monthNumStr = "08";
  let yearStr = "2026";
  let monthNameStr = "Aug";

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // Match YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = rawDate.match(/\b(201[7-9]|202[0-9]|2030)[/-](0[1-9]|1[0-2])[/-](0[1-9]|[12][0-9]|3[01])\b/);
  if (isoMatch) {
    yearStr = isoMatch[1];
    monthNumStr = isoMatch[2];
    dayStr = isoMatch[3];
    const mIdx = parseInt(monthNumStr) - 1;
    if (mIdx >= 0 && mIdx < 12) monthNameStr = monthNames[mIdx];
  } else {
    // Match DD-MM-YYYY or DD/MM/YYYY
    const dmyMatch = rawDate.match(/\b(0[1-9]|[12][0-9]|3[01])[/-](0[1-9]|1[0-2])[/-](201[7-9]|202[0-9]|2030)\b/);
    if (dmyMatch) {
      dayStr = dmyMatch[1];
      monthNumStr = dmyMatch[2];
      yearStr = dmyMatch[3];
      const mIdx = parseInt(monthNumStr) - 1;
      if (mIdx >= 0 && mIdx < 12) monthNameStr = monthNames[mIdx];
    }
  }

  const formattedDate = `${dayStr}-${monthNumStr}-${yearStr}`;

  // Assemble Filename: emp_nitin-993561427_m_29_20-11-2022.pdf
  const filename = `${catPrefix}_${nameRefPart}_${genderCode}_${ageStr}_${formattedDate}.pdf`;

  // Persistent base directory
  const currentSavedBase = getSavedBaseDir();
  const baseDir = (extractedMetadata.baseDir || currentSavedBase).replace(/\\$/, '');

  const subfolderPath = `\\${rawCat}\\${yearStr}\\${monthNameStr}\\`;
  const fullPath = `${baseDir}${subfolderPath}${filename}`;

  const subfolderBadge = document.getElementById("rename-subfolder-badge");
  if (subfolderBadge) subfolderBadge.innerText = subfolderPath;

  const pathPreview = document.getElementById("rename-full-path-preview");
  const modalPathPreview = document.getElementById("modal-path-preview");
  const outputFilenameEl = document.getElementById("rename-output-filename");

  if (pathPreview) pathPreview.innerText = fullPath;
  if (modalPathPreview) modalPathPreview.innerText = fullPath;
  if (outputFilenameEl) outputFilenameEl.value = filename;
}

function syncModalCategory(val) {
  extractedMetadata.category = val;
  updateSmartRenameUI();
}

function syncModalInputsToSidebar() {
  const mName = document.getElementById("modal-person-name");
  const mGender = document.getElementById("modal-gender");
  const mAge = document.getElementById("modal-age");
  const mId = document.getElementById("modal-ref-id");
  const mBase = document.getElementById("modal-base-dir");

  if (mName) extractedMetadata.personName = mName.value.trim();
  if (mGender) extractedMetadata.gender = mGender.value;
  if (mAge) extractedMetadata.age = mAge.value.trim();
  if (mId) extractedMetadata.refNo = mId.value.trim();
  if (mBase) extractedMetadata.baseDir = mBase.value.trim();

  updateSmartRenameUI();
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

  if (bottomBar) {
    if (pagesData.length > 0) {
      bottomBar.style.display = "flex";
      if (bottomText) bottomText.innerText = `${currentFilename} • ${cleanOutput} Clean Pages (${autoRemovedBlank} Blank Removed)`;
    } else {
      bottomBar.style.display = "none";
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

      <!-- Top Left Status Badge if Blank or Rotated -->
      ${statusBadgeHtml}

      <!-- Document Image Canvas -->
      <div class="pdf24-canvas-box">
        <img src="${p.thumbnail_url}" style="transform: rotate(${p.user_rotation}deg);" alt="Page ${p.page_num}">
      </div>

      <!-- PDF24 Bottom Right Prominent Zoom Badge Button -->
      <button class="pdf24-zoom-badge-btn" onclick="event.stopPropagation(); currentInspectIndex = ${p.page_index}; openPageZoomModal();" title="Inspect Page ${p.page_num} on Large Screen">
        🔍 Zoom
      </button>

      <!-- Hover Action Toolbar -->
      <div class="pdf24-hover-bar">
        <button class="pdf24-action-btn" onclick="event.stopPropagation(); rotatePage(${p.page_index}, -90)" title="Rotate Left">↶ 90°</button>
        <button class="pdf24-action-btn" onclick="event.stopPropagation(); rotatePage(${p.page_index}, 90)" title="Rotate Right">↷ 90°</button>
        <button class="pdf24-action-btn" onclick="event.stopPropagation(); toggleDeletePage(${p.page_index})" title="${p.user_deleted ? 'Keep Page' : 'Remove Page'}">
          ${p.user_deleted ? '↩️ Keep' : '🗑️ Del'}
        </button>
      </div>
    `;

    gridContainer.appendChild(card);

    // PDF24 VERTICAL SCISSOR CUT DIVIDER BETWEEN CARDS
    if (idx < filteredPages.length - 1) {
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

function resetModalZoom() {
  modalZoomScale = 1.0;
  applyModalZoom();
}

function applyModalZoom() {
  const canvas = document.getElementById("zoom-modal-canvas");
  const badge = document.getElementById("modal-zoom-level");
  if (canvas) {
    canvas.style.transform = `scale(${modalZoomScale})`;
    canvas.style.transformOrigin = "center center";
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
  const modal = document.getElementById(id);
  if (modal) modal.classList.add("active");
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove("active");
}

function openHelpModal() {
  openModal("help-modal");
}

function openInstallModal() {
  openModal("install-modal");
}

// WIDESCREEN FULLPAGE ZOOM READER MODAL
async function openPageZoomModal() {
  const p = pagesData[currentInspectIndex];
  if (!p) return;

  modalZoomScale = 1.0;
  const titleEl = document.getElementById("zoom-modal-title");
  if (titleEl) titleEl.innerText = `Page ${p.page_num} - High-Resolution Fullscreen Reader (${p.user_rotation}° Upright)`;

  const canvas = document.getElementById("zoom-modal-canvas");
  if (!canvas) return;

  // Try rendering high-res direct PDF page using PDF.js if available
  if (rawFileUint8Array && window.pdfjsLib) {
    try {
      showLoading("Rendering high-res page reader...");
      const loadingTask = pdfjsLib.getDocument({ data: rawFileUint8Array.slice() });
      const pdfDoc = await loadingTask.promise;
      const pdfPage = await pdfDoc.getPage(p.page_num);
      
      const viewport = pdfPage.getViewport({ scale: 2.0, rotation: p.user_rotation });
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
    canvas.width = img.width * 2;
    canvas.height = img.height * 2;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((p.user_rotation * Math.PI) / 180);
    ctx.drawImage(img, -img.width, -img.height, img.width * 2, img.height * 2);
    ctx.restore();

    applyModalZoom();
    openModal("zoom-modal");
  };
  img.src = p.thumbnail_url;
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

  showLoading("Generating cleaned PDF document...");
  try {
    let pdfBuffer = null;
    if (currentFileObject) {
      pdfBuffer = await currentFileObject.arrayBuffer();
    } else if (rawFileUint8Array) {
      pdfBuffer = rawFileUint8Array.slice().buffer;
    }

    if (!pdfBuffer) throw new Error("Source PDF buffer not found.");

    const srcPdfDoc = await PDFLib.PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
    const newPdf = await PDFLib.PDFDocument.create();

    const pageIndicesToCopy = activePages.map(p => p.page_index);
    const copiedPages = await newPdf.copyPages(srcPdfDoc, pageIndicesToCopy);

    copiedPages.forEach((page, copyIdx) => {
      const origPageData = activePages[copyIdx];
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

    // Compute exact target disk path
    const pathPreview = document.getElementById("rename-full-path-preview");
    const outputEl = document.getElementById("rename-output-filename");

    let exportName = outputEl ? outputEl.value.trim() : "";
    if (!exportName) {
      exportName = `${extractedMetadata.category}_${extractedMetadata.personName || 'Record'}_Cleaned.pdf`;
    }
    if (!exportName.toLowerCase().endsWith(".pdf")) exportName += ".pdf";

    let fullTargetPath = pathPreview ? pathPreview.innerText.trim() : "";
    if (!fullTargetPath) {
      fullTargetPath = `D:\\Scan\\${extractedMetadata.category}\\${exportName}`;
    }

    // MODE 1: 1-Click Direct Auto Save
    if (saveMode === 'auto') {
      try {
        const apiRes = await fetch("/api/save-to-disk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetPath: fullTargetPath,
            pdfBase64: base64Data
          })
        });

        if (apiRes.ok) {
          const result = await apiRes.json();
          if (result.success) {
            hideLoading();
            alert(`✓ PDF file automatically saved directly to target folder!\n\nSaved Target Path:\n${result.savedPath}`);
            return;
          }
        }
      } catch (e) {
        console.log("Direct server auto-save API unavailable, falling back to manual file picker.");
      }
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
        alert(`✓ PDF successfully saved to your selected local folder!\nSuggested Path: ${fullTargetPath}`);
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }

    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    downloadBlob(blob, exportName);
  } catch (err) {
    alert("Export Error: " + err.message);
  } finally {
    hideLoading();
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

// PWA Prompt
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

function triggerPwaPrompt() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(() => {
      deferredPrompt = null;
    });
  } else {
    alert("PWA is already installed or supported directly via your browser's Install App menu!");
  }
}
