# 🪄 PDF CleanSpace AI Pro

> **Smart AI PDF Blank Page Removal & Auto-Alignment Web & Desktop Application**  
> *Created for enterprise teams, office employees, and dataset curation.*

[![Live App on Vercel](https://img.shields.io/badge/Vercel-Live--App-10b981?style=for-the-badge&logo=vercel)](https://pdf-cleanspace-ai-pro.vercel.app)
[![PWA Ready](https://img.shields.io/badge/PWA-Installable--App-06b6d4?style=for-the-badge&logo=pwa)](https://pdf-cleanspace-ai-pro.vercel.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-a855f7.svg?style=for-the-badge)](LICENSE)

---

## 🌟 Overview

**PDF CleanSpace AI Pro** is a modern, high-precision web and desktop application designed to solve common document processing issues:
- Automatically **detects and removes blank pages**, empty table templates, notebook grid line prints, and stray mark pages.
- Automatically **detects text orientation angles** ($90^\circ, 180^\circ, 270^\circ$) and rotates misoriented pages upright to $0^\circ$.
- Protects **handwritten text, manuscript scans, receipts, and low-contrast documents** from false deletion.
- Provides a simple **3-step non-tech friendly workflow** so any employee can use it without prior training.

---

## ✨ Key Features

- 🎯 **Dual-Pass Hybrid Classifier**: Combines digital font parsing with 5×5 spatial grid ink distribution analysis to accurately distinguish between real document details and empty grid templates/stamps.
- 🔄 **AI Page Auto-Alignment Engine**: Evaluates text vector flow and line projection gradients to auto-align upside-down or sideways pages.
- 🤖 **Multimodal AI Vision Model Support**: Integrated Google Gemini 1.5/2.0 Flash Vision & OpenAI GPT-4o Vision REST API support for 100% human-grade visual verification.
- 🎨 **Emerald & Obsidian AI Studio UI**: Ultra-luxurious glassmorphism interface with non-tech guided workflow banners and 1-click controls.
- 📲 **Progressive Web App (PWA)**: Saves directly as a standalone desktop or mobile application on Windows, Mac, iOS, and Android.
- 📁 **Batch Folder Dataset Cleaner**: Clean entire directories of PDF dataset files in one automated run.

---

## 🚀 Live Demo & Deployment

- **Live Web App**: [https://pdf-cleanspace-ai-pro.vercel.app](https://pdf-cleanspace-ai-pro.vercel.app) *(Host via Vercel)*
- **GitHub Repository**: [https://github.com/sakshitiwari-24/pdf-cleanspace-ai-pro](https://github.com/sakshitiwari-24/pdf-cleanspace-ai-pro)

---

## 💻 Local Setup & Running Instructions

### Option 1: Double-Click Desktop Launcher (Windows)
Double-click `Launch_PDF_CleanSpace.bat` in the project root directory to launch the server and open the web app automatically in your browser.

### Option 2: Node.js Server
```bash
# Clone repository
git clone https://github.com/sakshitiwari-24/pdf-cleanspace-ai-pro.git
cd pdf-cleanspace-ai-pro

# Run Node.js web server
node server.js
```
Open your browser at `http://localhost:8000/`.

### Option 3: Python FastAPI Backend (CLI & API)
```bash
# Install Python dependencies
pip install -r requirements.txt

# Run Python launcher
python run_app.py
```

---

## 🛠️ Technology Stack

- **Frontend**: HTML5, CSS3 (Emerald & Obsidian Glassmorphism Theme), Vanilla JavaScript (ES6+)
- **Processing Libraries**: PDF.js (Client-side rendering), pdf-lib (Client-side PDF manipulation)
- **Backend / Engine**: Python 3.10+, PyMuPDF (fitz), FastAPI, Uvicorn, Tesseract OCR OSD
- **Multimodal AI**: Google Gemini Flash Vision API / OpenAI GPT-4o REST API
- **Deployment**: Vercel Serverless / Progressive Web App (PWA)

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
