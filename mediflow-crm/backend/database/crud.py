from sqlalchemy.orm import Session
from . import models
import schemas

def get_doctor(db: Session, doctor_id: int):
    return db.query(models.Doctor).filter(models.Doctor.id == doctor_id).first()

def get_doctor_by_name(db: Session, name: str):
    return db.query(models.Doctor).filter(models.Doctor.name.ilike(f"%{name}%")).first()

def get_doctors(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Doctor).offset(skip).limit(limit).all()

def create_doctor(db: Session, doctor: schemas.DoctorCreate):
    db_doctor = models.Doctor(**doctor.model_dump())
    db.add(db_doctor)
    db.commit()
    db.refresh(db_doctor)
    return db_doctor

def update_doctor(db: Session, doctor_id: int, doctor_update: schemas.DoctorUpdate):
    db_doctor = db.query(models.Doctor).filter(models.Doctor.id == doctor_id).first()
    if not db_doctor:
        return None
    update_data = doctor_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_doctor, key, value)
    db.commit()
    db.refresh(db_doctor)
    return db_doctor

def delete_doctor(db: Session, doctor_id: int):
    db_doctor = db.query(models.Doctor).filter(models.Doctor.id == doctor_id).first()
    if not db_doctor:
        return False
    
    # Cascade delete interactions
    interactions = db.query(models.Interaction).filter(models.Interaction.doctor_id == doctor_id).all()
    for interaction in interactions:
        delete_interaction(db, interaction.id)
        
    db.delete(db_doctor)
    db.commit()
    return True

def get_or_create_product(db: Session, name: str):
    product = db.query(models.Product).filter(models.Product.name.ilike(name)).first()
    if not product:
        product = models.Product(name=name, category="General")
        db.add(product)
        db.commit()
        db.refresh(product)
    return product

def create_interaction(db: Session, interaction: schemas.InteractionCreate):
    interaction_data = interaction.model_dump()
    product_names = interaction_data.pop("products", [])
    
    db_interaction = models.Interaction(**interaction_data)
    
    for p_name in product_names:
        if p_name.strip():
            db_prod = get_or_create_product(db, p_name.strip())
            db_interaction.products.append(db_prod)
            
    db.add(db_interaction)
    db.commit()
    db.refresh(db_interaction)
    return db_interaction

def get_interactions(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Interaction).order_by(models.Interaction.date.desc()).offset(skip).limit(limit).all()

def get_interactions_by_doctor(db: Session, doctor_id: int):
    return db.query(models.Interaction).filter(models.Interaction.doctor_id == doctor_id).order_by(models.Interaction.date.desc()).all()

def update_interaction(db: Session, interaction_id: int, interaction: schemas.InteractionUpdate):
    db_interaction = db.query(models.Interaction).filter(models.Interaction.id == interaction_id).first()
    if not db_interaction:
        return None
    update_data = interaction.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_interaction, key, value)
    db.commit()
    db.refresh(db_interaction)
    return db_interaction

def delete_interaction(db: Session, interaction_id: int):
    db_interaction = db.query(models.Interaction).filter(models.Interaction.id == interaction_id).first()
    if not db_interaction:
        return False
    
    # Also delete associated followups if they exist
    db.query(models.FollowUp).filter(models.FollowUp.interaction_id == interaction_id).delete()
    
    db.delete(db_interaction)
    db.commit()
    return True

def create_followup(db: Session, followup: schemas.FollowUpCreate):
    db_followup = models.FollowUp(**followup.model_dump())
    db.add(db_followup)
    db.commit()
    db.refresh(db_followup)
    return db_followup

def get_followups(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.FollowUp).filter(models.FollowUp.status == "Pending").order_by(models.FollowUp.date.asc()).offset(skip).limit(limit).all()
