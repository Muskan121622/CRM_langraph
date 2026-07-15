from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List

from database import models, crud
from database.database import SessionLocal, engine
import schemas

# Create tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="MediFlow AI CRM API")

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/doctors/", response_model=List[schemas.Doctor])
def read_doctors(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    doctors = crud.get_doctors(db, skip=skip, limit=limit)
    return doctors

@app.post("/doctors/", response_model=schemas.Doctor)
def create_doctor(doctor: schemas.DoctorCreate, db: Session = Depends(get_db)):
    return crud.create_doctor(db=db, doctor=doctor)

@app.get("/interactions/", response_model=List[schemas.Interaction])
def read_interactions(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_interactions(db, skip=skip, limit=limit)

@app.post("/interactions/", response_model=schemas.Interaction)
def create_interaction(interaction: schemas.InteractionCreate, db: Session = Depends(get_db)):
    return crud.create_interaction(db=db, interaction=interaction)

@app.put("/interactions/{interaction_id}", response_model=schemas.Interaction)
def update_interaction(interaction_id: int, interaction: schemas.InteractionUpdate, db: Session = Depends(get_db)):
    updated = crud.update_interaction(db, interaction_id, interaction)
    if not updated:
        raise HTTPException(status_code=404, detail="Interaction not found")
    return updated

@app.get("/followups/", response_model=List[schemas.FollowUp])
def read_followups(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_followups(db, skip=skip, limit=limit)

@app.get("/dashboard-stats/")
def get_dashboard_stats(db: Session = Depends(get_db)):
    # Simple aggregations
    visits_count = db.query(models.Interaction).count()
    pending_followups = db.query(models.FollowUp).filter(models.FollowUp.status == "Pending").count()
    positive_doctors = db.query(models.Interaction).filter(models.Interaction.sentiment == "Positive").count()
    samples_given = db.query(models.Interaction).with_entities(models.Interaction.samples_distributed).all()
    total_samples = sum([s[0] for s in samples_given if s[0]])
    
    total_interactions = visits_count
    positive_sentiment_ratio = (positive_doctors / total_interactions) if total_interactions > 0 else 0

    return {
        "today_visits": visits_count, 
        "total_interactions": total_interactions,
        "pending_followups": pending_followups,
        "positive_doctors": positive_doctors,
        "positive_sentiment_ratio": positive_sentiment_ratio,
        "negative_feedback": db.query(models.Interaction).filter(models.Interaction.sentiment == "Negative").count(),
        "samples_distributed": total_samples,
        "total_samples": total_samples,
        "top_product": "Diabetes Plus" # hardcoded or can aggregate
    }

from agent.router import router as agent_router
app.include_router(agent_router, prefix="/agent", tags=["agent"])
