import os
import uuid
import tempfile
from typing import List, Dict, Any
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import io

from backend.pdf_processor import PDFProcessor

app = FastAPI(title="PDF Cleaner & Manager API", version="1.0.0")

# Enable CORS for local web interface
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage for uploaded active PDF sessions
# Key: session_id, Value: dict with processor object & file bytes
SESSIONS: Dict[str, Dict[str, Any]] = {}

class PageAction(BaseModel):
    page_index: int
    deleted: bool = False
    rotation: int = 0  # relative degrees to add (0, 90, 180, 270)

class ExportRequest(BaseModel):
    session_id: str
    page_actions: List[PageAction]

class BatchDirectoryScanRequest(BaseModel):
    directory_path: str
    blank_sensitivity: float = 0.8
    auto_clean: bool = False
    output_directory: str = ""

@app.get("/api/health")
def health_check():
    return {"status": "ok", "active_sessions": len(SESSIONS)}

@app.post("/api/upload")
async def upload_pdf(
    file: UploadFile = File(...),
    blank_sensitivity: float = Form(0.8)
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    file_bytes = await file.read()
    session_id = str(uuid.uuid4())

    try:
        processor = PDFProcessor(file_bytes)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse PDF file: {str(e)}")

    pages_analysis = []
    blank_count = 0
    rotated_count = 0

    for i in range(processor.page_count):
        analysis = processor.analyze_page(i, blank_sensitivity=blank_sensitivity)
        pages_analysis.append(analysis)
        if analysis["is_blank"]:
            blank_count += 1
        if analysis["needs_rotation"]:
            rotated_count += 1

    SESSIONS[session_id] = {
        "filename": file.filename,
        "bytes": file_bytes,
        "processor": processor,
        "analysis": pages_analysis
    }

    return {
        "session_id": session_id,
        "filename": file.filename,
        "total_pages": processor.page_count,
        "blank_pages_count": blank_count,
        "rotated_pages_count": rotated_count,
        "pages": pages_analysis
    }

@app.get("/api/thumbnail/{session_id}/{page_index}")
def get_thumbnail(session_id: str, page_index: int, max_size: int = Query(350)):
    if session_id not in SESSIONS:
        raise HTTPException(status_code=404, detail="Session not found or expired.")

    session = SESSIONS[session_id]
    processor: PDFProcessor = session["processor"]

    if page_index < 0 or page_index >= processor.page_count:
        raise HTTPException(status_code=400, detail="Invalid page index.")

    try:
        img_bytes = processor.render_page_thumbnail(page_index, max_dimension=max_size)
        return Response(content=img_bytes, media_type="image/png")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error rendering thumbnail: {str(e)}")

@app.post("/api/export")
def export_pdf(req: ExportRequest):
    if req.session_id not in SESSIONS:
        raise HTTPException(status_code=404, detail="Session not found.")

    session = SESSIONS[req.session_id]
    processor: PDFProcessor = session["processor"]

    actions_list = [action.dict() for action in req.page_actions]

    try:
        cleaned_bytes = processor.export_cleaned_pdf(actions_list)
        orig_filename = session["filename"]
        base_name, ext = os.path.splitext(orig_filename)
        cleaned_filename = f"{base_name}_cleaned.pdf"

        return Response(
            content=cleaned_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{cleaned_filename}"'
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")

@app.post("/api/batch-scan-folder")
def batch_scan_folder(req: BatchDirectoryScanRequest):
    dir_path = req.directory_path.strip()
    if not os.path.isdir(dir_path):
        raise HTTPException(status_code=400, detail="Invalid directory path.")

    pdf_files = [f for f in os.listdir(dir_path) if f.lower().endswith(".pdf")]
    if not pdf_files:
        return {"message": "No PDF files found in specified directory.", "results": []}

    out_dir = req.output_directory.strip() if req.output_directory else os.path.join(dir_path, "cleaned_output")
    if req.auto_clean:
        os.makedirs(out_dir, exist_ok=True)

    results = []

    for fname in pdf_files:
        full_path = os.path.join(dir_path, fname)
        try:
            processor = PDFProcessor(full_path)
            total_pages = processor.page_count
            blank_pages = []
            rotated_pages = []
            page_actions = []

            for i in range(total_pages):
                ana = processor.analyze_page(i, blank_sensitivity=req.blank_sensitivity)
                is_blank = ana["is_blank"]
                rot = ana["suggested_rotation"]

                if is_blank:
                    blank_pages.append(i + 1)
                if rot != 0:
                    rotated_pages.append({"page": i + 1, "suggested_rotation": rot})

                page_actions.append({
                    "page_index": i,
                    "deleted": is_blank,
                    "rotation": rot
                })

            cleaned_file_path = None
            if req.auto_clean:
                cleaned_bytes = processor.export_cleaned_pdf(page_actions)
                cleaned_fname = f"{os.path.splitext(fname)[0]}_cleaned.pdf"
                cleaned_file_path = os.path.join(out_dir, cleaned_fname)
                with open(cleaned_file_path, "wb") as f_out:
                    f_out.write(cleaned_bytes)

            processor.close()

            results.append({
                "filename": fname,
                "filepath": full_path,
                "total_pages": total_pages,
                "blank_count": len(blank_pages),
                "blank_page_numbers": blank_pages,
                "rotated_count": len(rotated_pages),
                "rotated_pages": rotated_pages,
                "cleaned_output_path": cleaned_file_path
            })
        except Exception as e:
            results.append({
                "filename": fname,
                "filepath": full_path,
                "error": str(e)
            })

    return {
        "scanned_directory": dir_path,
        "total_files": len(pdf_files),
        "output_directory": out_dir if req.auto_clean else None,
        "results": results
    }

class AiClassifyRequest(BaseModel):
    session_id: str
    page_index: int
    provider: str = "gemini"
    api_key: str = ""
    model_name: str = ""

class AiTestKeyRequest(BaseModel):
    provider: str = "gemini"
    api_key: str = ""
    model_name: str = ""

@app.post("/api/ai-classify-page")
def ai_classify_page_route(req: AiClassifyRequest):
    if req.session_id not in SESSIONS:
        raise HTTPException(status_code=404, detail="Session not found or expired.")

    session = SESSIONS[req.session_id]
    processor: PDFProcessor = session["processor"]

    try:
        res = processor.ai_classify_page(
            page_index=req.page_index,
            provider=req.provider,
            api_key=req.api_key,
            model_name=req.model_name
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Vision classification error: {str(e)}")

@app.post("/api/test-ai-key")
def test_ai_key_route(req: AiTestKeyRequest):
    from backend.pdf_processor import call_vision_ai_api
    test_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
    try:
        res = call_vision_ai_api(test_base64, provider=req.provider, api_key=req.api_key, model_name=req.model_name)
        return {"status": "ok", "provider": req.provider, "model": req.model_name, "response": res}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"API connection test failed: {str(e)}")

# Mount static web frontend files
frontend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
if os.path.exists(frontend_path):
    app.mount("/static", StaticFiles(directory=frontend_path), name="static")

@app.get("/")
def read_root():
    index_file = os.path.join(frontend_path, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return {"message": "PDF Cleaner Backend API is running."}

