from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Table
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

# Association Table for Many-to-Many relationship between Interactions and Products
interaction_product = Table(
    'interaction_product',
    Base.metadata,
    Column('interaction_id', Integer, ForeignKey('interactions.id', ondelete="CASCADE"), primary_key=True),
    Column('product_id', Integer, ForeignKey('products.id', ondelete="CASCADE"), primary_key=True)
)

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, unique=True)
    category = Column(String)

    interactions = relationship("Interaction", secondary=interaction_product, back_populates="products")

class Doctor(Base):
    __tablename__ = "doctors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    specialty = Column(String, nullable=True) # Allow null for specialty
    hospital = Column(String, nullable=True)
    
    interactions = relationship("Interaction", back_populates="doctor")

class Interaction(Base):
    __tablename__ = "interactions"

    id = Column(Integer, primary_key=True, index=True)
    doctor_id = Column(Integer, ForeignKey("doctors.id"))
    date = Column(DateTime, default=datetime.utcnow)
    interaction_type = Column(String) # e.g., "In-Person", "Virtual"
    topics = Column(String)
    materials = Column(String)
    samples_distributed = Column(Integer, default=0)
    samples_requested = Column(Integer, default=0)
    sentiment = Column(String) # e.g., "Positive", "Negative", "Neutral"
    notes = Column(Text)
    
    doctor = relationship("Doctor", back_populates="interactions")
    followups = relationship("FollowUp", back_populates="interaction")
    products = relationship("Product", secondary=interaction_product, back_populates="interactions")

class FollowUp(Base):
    __tablename__ = "followups"

    id = Column(Integer, primary_key=True, index=True)
    interaction_id = Column(Integer, ForeignKey("interactions.id"))
    date = Column(DateTime)
    action = Column(String)
    status = Column(String, default="Pending") # "Pending", "Completed"
    
    interaction = relationship("Interaction", back_populates="followups")
