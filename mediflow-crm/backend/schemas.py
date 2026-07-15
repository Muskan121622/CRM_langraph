from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List

class DoctorBase(BaseModel):
    name: str
    specialty: Optional[str] = None
    hospital: Optional[str] = None

class DoctorCreate(DoctorBase):
    pass

class DoctorUpdate(BaseModel):
    name: Optional[str] = None
    specialty: Optional[str] = None
    hospital: Optional[str] = None

class Doctor(DoctorBase):
    id: int
    class Config:
        from_attributes = True

class ProductBase(BaseModel):
    name: str
    category: Optional[str] = None

class ProductCreate(ProductBase):
    pass

class Product(ProductBase):
    id: int
    class Config:
        from_attributes = True

class InteractionBase(BaseModel):
    doctor_id: int
    interaction_type: Optional[str] = None
    topics: Optional[str] = None
    materials: Optional[str] = None
    samples_distributed: Optional[int] = 0
    samples_requested: Optional[int] = 0
    sentiment: Optional[str] = None
    notes: Optional[str] = None

class InteractionCreate(InteractionBase):
    # Expect a list of product names when creating
    products: Optional[List[str]] = []

class InteractionUpdate(BaseModel):
    doctor_id: Optional[int] = None
    interaction_type: Optional[str] = None
    topics: Optional[str] = None
    materials: Optional[str] = None
    samples_distributed: Optional[int] = None
    samples_requested: Optional[int] = None
    sentiment: Optional[str] = None
    notes: Optional[str] = None

class Interaction(InteractionBase):
    id: int
    date: datetime
    products: List[Product] = []
    doctor: Optional[Doctor] = None
    class Config:
        from_attributes = True

class FollowUpBase(BaseModel):
    interaction_id: int
    date: datetime
    action: str
    status: Optional[str] = "Pending"

class FollowUpCreate(FollowUpBase):
    pass

class FollowUp(FollowUpBase):
    id: int
    class Config:
        from_attributes = True
