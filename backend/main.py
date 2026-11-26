import json, sqlite3, time
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import models as M

app = FastAPI(title="Hybrid Lab API")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000"], allow_methods=["*"], allow_headers=["*"])
DB = "hybrid_lab.db"

def db():
    c = sqlite3.connect(DB); c.row_factory = sqlite3.Row
    c.execute("CREATE TABLE IF NOT EXISTS runs (id INTEGER PRIMARY KEY, ts REAL, task TEXT, paradigm TEXT, size INTEGER, result TEXT)")
    return c

class SimReq(BaseModel):
    task: str; paradigm: str; size: int = Field(gt=0)
class QReq(BaseModel):
    shots: int = Field(1000, ge=10, le=20000); noise: float = Field(0, ge=0, le=0.5)

def check(task, paradigm=None):
    if task not in M.TASKS or (paradigm and paradigm not in M.PARADIGMS):
        raise HTTPException(404, "Unknown task or paradigm")

@app.get("/api/config")
def config():
    return {"tasks": M.TASKS, "paradigms": M.PARADIGMS, "stages": M.STAGES}

@app.post("/api/simulate")
def simulate(r: SimReq):
    check(r.task, r.paradigm)
    res = {"estimate": M.estimate(r.paradigm, r.task, r.size), "timeline": M.timeline(r.paradigm)}
    with db() as c:
        c.execute("INSERT INTO runs (ts,task,paradigm,size,result) VALUES (?,?,?,?,?)",
                  (time.time(), r.task, r.paradigm, r.size, json.dumps(res["estimate"])))
    return res

@app.get("/api/compare")
def compare(task: str, size: int):
    check(task)
    return [{"paradigm": k, "name": v["name"], "why": v["why"], **M.estimate(k, task, size)} for k, v in M.PARADIGMS.items()]

@app.post("/api/quantum")
def quantum(r: QReq):
    return M.bell(r.shots, r.noise)

@app.get("/api/history")
def history():
    with db() as c:
        rows = c.execute("SELECT * FROM runs ORDER BY id DESC LIMIT 20").fetchall()
    return [{**dict(r), "result": json.loads(r["result"])} for r in rows]

@app.delete("/api/history")
def clear():
    with db() as c: c.execute("DELETE FROM runs")
    return {"ok": True}
