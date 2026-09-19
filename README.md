# 🪄 PDF CleanSpace AI Pro

> **Smart AI PDF Blank Page Removal, Auto-Alignment, Operator Counter & Multi-Category Record Manager**  
> *Created for enterprise teams, office operators, and dataset curation.*

[![Live App on Vercel](https://img.shields.io/badge/Vercel-Live--App-10b981?style=for-the-badge&logo=vercel)](https://pdf-cleanspace-studio.vercel.app)
[![PWA Ready](https://img.shields.io/badge/PWA-Installable--App-06b6d4?style=for-the-badge&logo=pwa)](https://pdf-cleanspace-studio.vercel.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-a855f7.svg?style=for-the-badge)](LICENSE)

---

## 🌟 Overview

**PDF CleanSpace AI Pro** is a modern, high-precision web and desktop application designed to streamline document curation, blank page removal, auto-rotation, operator performance tracking, and multi-category record management:
- Automatically **detects and removes blank pages**, empty table templates, and stray marks.
- Automatically **detects text orientation angles** ($90^\circ, 180^\circ, 270^\circ$) and rotates misoriented pages upright.
- Organizes files into **Category / Year / Month / Day** dynamic folder hierarchies on local disk (`\Category\Year\Month\DD\`).
- Tracks **Operator Performance & Date-Wise File Processing Counts** with real-time badges, daily breakdown tables, and CSV audit reports.
- Formats all operational dates strictly in **DMY (`DD-MM-YYYY`) format** across UI views, logs, and exported reports.
- Supports **Interactive Sequential Multi-Person PDF Splitting**: Process & save Part 1 to its target location, auto-trim Part 1's pages, and continuously move to Part 2!

---

## ✨ Key Features

- 👤 **Operator Tracking & Live Counter**: Select or register operator names (`Sakshi`, `Operator 1`, etc.) with real-time navbar counter pills (`📊 Today: X | Total: Y`) that pulse on every saved file.
- 📅 **Date-Wise Work Summary Table**: Inspect file processing counts broken down by calendar dates (`DD-MM-YYYY`) with active operator breakdowns and one-click date inspection filters.
- 📥 **CSV Audit Exporter**: One-click download of full operator processing logs and date-filtered audit reports (`operator_processing_report_DD-MM-YYYY.csv`).
- 🎯 **Dual-Pass Hybrid Classifier**: Combines digital font parsing with 5×5 spatial grid ink distribution analysis.
- 📂 **Dynamic Hierarchy Target Path**: Automatically builds `\Category\Year\Month\DD\` folder structures (e.g. `D:\RAILWAY\Employee\2020\Feb\06\`).
- 📄 **Clean Standardized Filenames**: Generates standardized, structured filenames following the `category_name_gender_age_ref.no._dd-mm-yy` schema (e.g. `emp_rameshwar-kumar_M_45_993561427_06-02-20.pdf`).
- 🔍 **HD Fullscreen Zoom Reader**: Interactive reader with Previous (`◀`) / Next (`▶`) toolbar & floating buttons, and arrow key shortcuts (`←` / `→`) to flip pages directly in zoom mode.
- ✂️ **Sequential Multi-Part PDF Splitter**: Processes multi-person PDFs sequentially part-by-part, allowing different categories and saving locations for each split segment.
- 💾 **1-Click Direct Local Auto-Saver**: Saves PDFs directly to specified disk folders via local Node server endpoint `/api/save-to-disk`.
- 📲 **Progressive Web App (PWA)**: Installable as a standalone desktop app on Windows, Mac, iOS, and Android.

---

## 📂 Target Directory & Filename Schema

### Folder Hierarchy (`\Category\Year\Month\DD\`)
```
[Base Path] (Saved per device, e.g. D:\RAILWAY or C:\CompanyScans)
 └── 📁 Employee / Family / Retired
      └── 📁 Year (e.g. 2020)
           └── 📁 Month (e.g. Feb)
                └── 📁 Day (2 Digits, e.g. 06)
                     └── 📄 emp_rameshwar-kumar_M_45_993561427_06-02-20.pdf
```

---

## 🚀 Live Demo & Deployment

- 🌐 **Live Web App**: [https://pdf-cleanspace-studio.vercel.app](https://pdf-cleanspace-studio.vercel.app)
- 🐙 **GitHub Repository**: [https://github.com/Sakshitiwari-24/pdf-cleanspace-ai-pro](https://github.com/Sakshitiwari-24/pdf-cleanspace-ai-pro)

---

## 💻 Local Setup & Running Instructions

### Option 1: Double-Click Desktop Launcher (Windows)
Double-click `Launch_PDF_CleanSpace.bat` in the project root directory to launch the server and open the web app automatically in your browser.

### Option 2: Node.js Web Server
```bash
git clone https://github.com/Sakshitiwari-24/pdf-cleanspace-ai-pro.git
cd pdf-cleanspace-ai-pro
node server.js
```
Open your browser at `http://localhost:8000/`.

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

