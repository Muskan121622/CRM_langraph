from langchain_core.tools import tool
from pydantic import BaseModel, Field
from datetime import datetime
from database.database import SessionLocal
from database import crud, models
import schemas

# Analytics Input Model
class AnalyticsInput(BaseModel):
    intent: str = Field(description="Should always be 'analytics'", default="analytics")
    metric: str = Field(description="Metric to aggregate (e.g., 'samples_requested', 'samples_distributed', 'visits', 'products', 'meetings', 'sentiment')", default="visits")
    group: str = Field(description="Entity to group by (e.g., 'doctor', 'hospital', 'product', 'specialty')", default="doctor")
    operator: str = Field(description="Operator for filtering numeric metrics (e.g., '>', '<', '=', '>=', '<=')", default="")
    threshold: int = Field(description="Numeric threshold for the operator", default=0)
    value: str = Field(description="String value to filter by (e.g., 'Positive' for sentiment)", default="")
    period: str = Field(description="Time period (e.g., 'today', 'week', 'month')", default="")

@tool("analytics_query", args_schema=AnalyticsInput)
def analytics_tool(metric: str = "visits", group: str = "doctor", operator: str = "", threshold: int = 0, value: str = "", period: str = "", intent: str = "analytics") -> str:
    """Answers analytical questions about the CRM data, such as 'Which doctors requested > 20 samples?', 'Top hospitals this month', 'Most discussed product'."""
    db = SessionLocal()
    try:
        from sqlalchemy import func
        from datetime import datetime, timedelta
        
        if group not in ["doctor", "hospital", "specialty", "product"]:
            return f"Unsupported grouping: {group}. Try doctor, hospital, specialty, or product."
            
        # Select the label based on group
        if group == "doctor":
            select_label = models.Doctor.name.label("group_name")
            group_by_col = models.Doctor.id
        elif group == "hospital":
            select_label = models.Doctor.hospital.label("group_name")
            group_by_col = models.Doctor.hospital
        elif group == "specialty":
            select_label = models.Doctor.specialty.label("group_name")
            group_by_col = models.Doctor.specialty
        elif group == "product":
            select_label = models.Product.name.label("group_name")
            group_by_col = models.Product.id

        # Determine metric aggregation
        if metric in ["samples_requested", "samples_distributed"]:
            agg_col = func.sum(getattr(models.Interaction, metric)).label("total")
        elif metric in ["visits", "meetings", "products", "sentiment"]:
            agg_col = func.count(models.Interaction.id).label("total")
        else:
            return f"Unsupported metric: {metric}. Try samples_requested, visits, products, etc."
        
        if group == "product":
            query = db.query(select_label, agg_col).select_from(models.Product).join(models.interaction_product).join(models.Interaction)
        else:
            query = db.query(select_label, agg_col).select_from(models.Doctor).join(models.Interaction)
            
        # Apply filters BEFORE aggregation
        if period:
            now = datetime.utcnow()
            if period == "today":
                start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
            elif period == "week":
                start_date = now - timedelta(days=7)
            elif period == "month":
                start_date = now - timedelta(days=30)
            else:
                start_date = None
            if start_date:
                query = query.filter(models.Interaction.date >= start_date)
                
        if metric == "sentiment" and value:
            query = query.filter(models.Interaction.sentiment.ilike(f"%{value}%"))
            
        # Ignore null group names for things like hospital or specialty
        if group == "hospital":
            query = query.filter(models.Doctor.hospital != None)
        elif group == "specialty":
            query = query.filter(models.Doctor.specialty != None)

        # Apply grouping
        query = query.group_by(group_by_col)
        
        # Apply HAVING filters based on threshold and operator
        if threshold != 0 and operator:
            if metric in ["samples_requested", "samples_distributed"]:
                having_col = func.sum(getattr(models.Interaction, metric))
            else:
                having_col = func.count(models.Interaction.id)
                
            if operator == ">": query = query.having(having_col > threshold)
            elif operator == "<": query = query.having(having_col < threshold)
            elif operator == ">=": query = query.having(having_col >= threshold)
            elif operator == "<=": query = query.having(having_col <= threshold)
            elif operator == "=": query = query.having(having_col == threshold)

        # Order by highest total
        query = query.order_by(agg_col.desc())
        
        results = query.all()
        
        if not results:
            return f"No records found matching criteria: {metric} by {group}."
            
        lines = [f"📊 **Analytics Result**", f"Metric: {metric} | Grouping: {group}"]
        if period: lines.append(f"Period: {period}")
        if operator and threshold != 0: lines.append(f"Filter: {operator} {threshold}")
        lines.append("")
        for row in results:
            name = row.group_name or "Unknown"
            lines.append(f"- **{name}**: {row.total}")
            
        return "\n".join(lines)
    except Exception as e:
        return f"Error executing analytics query: {str(e)}"
    finally:
        db.close()


class LogInteractionInput(BaseModel):
    doctor_name: str = Field(description="Name of the doctor")
    hospital: str = Field(description="Hospital name", default="")
    specialty: str = Field(description="Doctor's specialty", default="")
    interaction_type: str = Field(description="Type of interaction", default="In-Person")
    topics: str = Field(description="Topics discussed")
    products: str = Field(description="Products discussed")
    materials: str = Field(description="Materials shared", default="")
    samples_distributed: int = Field(description="Number of samples given to the doctor during the visit", default=0)
    samples_requested: int = Field(description="Number of samples the doctor requested for the future", default=0)
    sentiment: str = Field(description="Sentiment of the meeting (Positive, Negative, Neutral).", default="Neutral")
    notes: str = Field(description="General notes from the meeting")
    action: str = Field(description="Follow-up action", default="")
    days_from_now: int = Field(description="Days until follow-up", default=7)

@tool("log_interaction", args_schema=LogInteractionInput)
def log_interaction_tool(doctor_name: str, topics: str, products: str, samples_distributed: int, sentiment: str, notes: str, hospital: str = "", specialty: str = "", interaction_type: str = "In-Person", materials: str = "", samples_requested: int = 0, action: str = "", days_from_now: int = 7) -> str:
    """Saves a new meeting interaction into the database."""
    from datetime import timedelta
    db = SessionLocal()
    try:
        doctor = crud.get_doctor_by_name(db, name=doctor_name)
        if not doctor:
            doctor = crud.create_doctor(db, schemas.DoctorCreate(name=doctor_name, specialty=specialty or None, hospital=hospital or None))
        else:
            updated = False
            if specialty and not doctor.specialty:
                doctor.specialty = specialty
                updated = True
            if hospital and not doctor.hospital:
                doctor.hospital = hospital
                updated = True
            if updated:
                db.commit()
                db.refresh(doctor)
        
        product_list = [p.strip() for p in products.split(",") if p.strip()]
        
        interaction = schemas.InteractionCreate(
            doctor_id=doctor.id,
            interaction_type=interaction_type,
            topics=topics,
            products=product_list,
            materials=materials,
            samples_distributed=samples_distributed,
            samples_requested=samples_requested,
            sentiment=sentiment,
            notes=notes
        )
        created = crud.create_interaction(db, interaction)
        
        msg = f"Interaction logged successfully with ID {created.id} for Dr. {doctor.name}."
        
        if action:
            followup_date = datetime.utcnow() + timedelta(days=days_from_now)
            followup = schemas.FollowUpCreate(
                interaction_id=created.id,
                date=followup_date,
                action=action
            )
            crud.create_followup(db, followup)
            msg += f" Follow-up task scheduled for {followup_date.strftime('%Y-%m-%d')}."
            
        return msg
    finally:
        db.close()


class EditInteractionInput(BaseModel):
    interaction_id: int = Field(description="ID of the interaction to update", default=0)
    doctor_name: str = Field(description="New doctor name if it needs to be updated", default="")
    interaction_type: str = Field(description="Type of interaction", default="")
    topics: str = Field(description="Topics discussed", default="")
    materials: str = Field(description="Materials shared", default="")
    samples_distributed: int = Field(description="Samples distributed", default=-1)
    samples_requested: int = Field(description="Samples requested", default=-1)
    sentiment: str = Field(description="Sentiment of the meeting", default="")
    notes: str = Field(description="General notes", default="")

@tool("edit_interaction", args_schema=EditInteractionInput)
def edit_interaction_tool(interaction_id: int = 0, doctor_name: str = "", interaction_type: str = "", topics: str = "", materials: str = "", samples_distributed: int = -1, samples_requested: int = -1, sentiment: str = "", notes: str = "") -> str:
    """Updates an existing interaction in the database."""
    db = SessionLocal()
    try:
        if not interaction_id and doctor_name:
            doctor = crud.get_doctor_by_name(db, name=doctor_name)
            if doctor:
                interactions = crud.get_interactions_by_doctor(db, doctor.id)
                if interactions:
                    interaction_id = interactions[0].id
        if not interaction_id:
            return "Could not find a valid interaction to edit. Please specify a doctor name or interaction ID."

        update_data = {}
        if samples_distributed != -1: update_data["samples_distributed"] = samples_distributed
        if samples_requested != -1: update_data["samples_requested"] = samples_requested
        if sentiment: update_data["sentiment"] = sentiment
        if notes: update_data["notes"] = notes
        if materials: update_data["materials"] = materials
        if topics: update_data["topics"] = topics
        if interaction_type: update_data["interaction_type"] = interaction_type

        if not update_data:
            return "No fields provided to update."

        updated = crud.update_interaction(db, interaction_id, schemas.InteractionUpdate(**update_data))
        if updated:
            return f"Interaction {interaction_id} updated successfully."
        return f"Interaction {interaction_id} not found."
    finally:
        db.close()


class EditDoctorInput(BaseModel):
    doctor_id: int = Field(description="ID of the doctor to update", default=0)
    old_name: str = Field(description="Current name if ID unknown", default="")
    new_name: str = Field(description="New name for the doctor", default="")
    specialty: str = Field(description="New specialty", default="")
    hospital: str = Field(description="New hospital", default="")

@tool("edit_doctor", args_schema=EditDoctorInput)
def edit_doctor_tool(doctor_id: int = 0, old_name: str = "", new_name: str = "", specialty: str = "", hospital: str = "") -> str:
    """Updates a doctor's profile in the database."""
    db = SessionLocal()
    try:
        if not doctor_id and old_name:
            doctor = crud.get_doctor_by_name(db, name=old_name)
            if doctor:
                doctor_id = doctor.id
        
        if not doctor_id:
            return f"Could not find doctor {old_name} to edit."
            
        update_data = {}
        if new_name: update_data["name"] = new_name
        if specialty: update_data["specialty"] = specialty
        if hospital: update_data["hospital"] = hospital
        
        if not update_data:
            return "No fields provided to update for the doctor."
        
        doctor = db.query(models.Doctor).filter(models.Doctor.id == doctor_id).first()
        old_name_text = doctor.name if doctor else old_name
            
        updated = crud.update_doctor(db, doctor_id, schemas.DoctorUpdate(**update_data))
        if updated:
            if new_name and old_name_text and old_name_text != new_name:
                interactions = crud.get_interactions_by_doctor(db, doctor_id)
                for interaction in interactions:
                    if interaction.notes and old_name_text in interaction.notes:
                        interaction.notes = interaction.notes.replace(old_name_text, new_name)
                        db.add(interaction)
                db.commit()
            return "Doctor profile updated successfully."
        return f"Doctor {doctor_id} not found."
    finally:
        db.close()


class DeleteDoctorInput(BaseModel):
    doctor_name: str = Field(description="Name of the doctor to delete")

@tool("delete_doctor", args_schema=DeleteDoctorInput)
def delete_doctor_tool(doctor_name: str) -> str:
    """Deletes a doctor profile and all associated interactions from the database."""
    db = SessionLocal()
    try:
        doctor = crud.get_doctor_by_name(db, name=doctor_name)
        if not doctor:
            return f"Doctor {doctor_name} not found to delete."
        
        deleted = crud.delete_doctor(db, doctor.id)
        if deleted:
            return f"Doctor profile '{doctor_name}' and all associated records deleted successfully."
        return f"Failed to delete doctor {doctor_name}."
    finally:
        db.close()


class DeleteInteractionInput(BaseModel):
    interaction_id: int = Field(description="ID of the interaction to delete", default=0)
    doctor_name: str = Field(description="Doctor name if interaction ID unknown", default="")
    delete_all: bool = Field(description="Delete all interactions for this doctor", default=False)

@tool("delete_interaction", args_schema=DeleteInteractionInput)
def delete_interaction_tool(interaction_id: int = 0, doctor_name: str = "", delete_all: bool = False) -> str:
    """Deletes an interaction from the database."""
    db = SessionLocal()
    try:
        if delete_all and doctor_name:
            doctor = crud.get_doctor_by_name(db, name=doctor_name)
            if doctor:
                interactions = crud.get_interactions_by_doctor(db, doctor.id)
                if interactions:
                    count = 0
                    for interaction in interactions:
                        if crud.delete_interaction(db, interaction.id):
                            count += 1
                    return f"{count} interactions for Dr. {doctor_name} deleted successfully."
            return f"No interactions found for Dr. {doctor_name} to delete."

        if not interaction_id and doctor_name:
            doctor = crud.get_doctor_by_name(db, name=doctor_name)
            if doctor:
                interactions = crud.get_interactions_by_doctor(db, doctor.id)
                if interactions:
                    interaction_id = interactions[-1].id
                    
        if not interaction_id:
            return "Could not find a valid interaction to delete for this doctor."
            
        deleted = crud.delete_interaction(db, interaction_id)
        if deleted:
            return f"Interaction {interaction_id} deleted successfully."
        return f"Interaction {interaction_id} not found."
    finally:
        db.close()


class SearchHCPInput(BaseModel):
    doctor_name: str = Field(description="Name of the doctor to search for", default="")
    product: str = Field(description="Product name to filter interactions by", default="")
    hospital: str = Field(description="Hospital name to filter by", default="")
    specialty: str = Field(description="Doctor specialty to filter by", default="")
    sentiment: str = Field(description="Sentiment to filter by", default="")

@tool("search_hcp_history", args_schema=SearchHCPInput)
def search_hcp_history_tool(doctor_name: str = "", product: str = "", hospital: str = "", specialty: str = "", sentiment: str = "") -> str:
    """Searches interactions by any combination of doctor name, product, hospital, specialty, or sentiment."""
    db = SessionLocal()
    try:
        query = db.query(models.Interaction).join(models.Doctor)

        if doctor_name:
            query = query.filter(models.Doctor.name.ilike(f"%{doctor_name}%"))
        if hospital:
            query = query.filter(models.Doctor.hospital.ilike(f"%{hospital}%"))
        if specialty:
            query = query.filter(models.Doctor.specialty.ilike(f"%{specialty}%"))
        if sentiment:
            query = query.filter(models.Interaction.sentiment.ilike(f"%{sentiment}%"))
        if product:
            query = query.join(models.interaction_product).join(models.Product).filter(
                models.Product.name.ilike(f"%{product}%")
            )

        interactions = query.order_by(models.Interaction.date.desc()).limit(10).all()

        criteria = []
        if doctor_name: criteria.append(f"doctor '{doctor_name}'")
        if product: criteria.append(f"product '{product}'")
        if hospital: criteria.append(f"hospital '{hospital}'")
        if specialty: criteria.append(f"specialty '{specialty}'")
        if sentiment: criteria.append(f"sentiment '{sentiment}'")
        criteria_str = ", ".join(criteria) if criteria else "all records"

        if not interactions:
            return f"🔍 No interactions found matching {criteria_str}."

        history = []
        for idx, i in enumerate(interactions[:5]):
            doctor = i.doctor
            product_list = ", ".join([p.name for p in i.products]) if getattr(i, "products", None) else "None"
            mat_list = "\n".join([f"- {m.strip()}" for m in i.materials.split(',')]) if i.materials else "None"

            entry = f"**Interaction {idx+1}**\n\n"
            entry += f"👨‍⚕️ Doctor: {doctor.name}\n\n"
            entry += f"📅 Date: {i.date.strftime('%d %B %Y')}\n\n"
            entry += f"🏥 Hospital: {doctor.hospital or 'Not specified'}\n\n"
            entry += f"🔬 Specialty: {doctor.specialty or 'Not specified'}\n\n"
            entry += f"📝 Topic: {i.topics or 'Not specified'}\n\n"
            entry += f"💊 Product Discussed: {product_list}\n\n"
            entry += f"{'😊' if i.sentiment == 'Positive' else '😞' if i.sentiment == 'Negative' else '😐'} Sentiment: {i.sentiment or 'Neutral'}\n\n"
            if getattr(i, "samples_distributed", 0) or getattr(i, "samples_requested", 0):
                entry += f"📦 Samples: {i.samples_distributed} distributed, {i.samples_requested} requested\n\n"
            entry += f"📄 Materials Shared:\n{mat_list}\n\n"
            entry += f"📋 Summary:\n{i.notes or i.topics or 'No summary provided.'}\n\n"
            history.append(entry)

        header = f"🔍 **Search Results**\n\nFound {len(interactions)} interaction(s) matching {criteria_str}.\n\n"
        return header + "---\n\n".join(history)
    finally:
        db.close()


class ScheduleFollowupInput(BaseModel):
    doctor_name: str = Field(description="Name of the doctor")
    action: str = Field(description="Action to take in follow-up")
    days_from_now: int = Field(description="Number of days from now to schedule")

@tool("schedule_followup", args_schema=ScheduleFollowupInput)
def schedule_followup_tool(doctor_name: str, action: str, days_from_now: int) -> str:
    """Creates a follow-up task for a doctor."""
    from datetime import timedelta
    db = SessionLocal()
    try:
        doctor = crud.get_doctor_by_name(db, name=doctor_name)
        if not doctor:
            return f"Doctor {doctor_name} not found, cannot schedule follow-up."
        
        interactions = crud.get_interactions_by_doctor(db, doctor.id)
        if not interactions:
            return f"Please log an interaction with Dr. {doctor.name} before scheduling a follow-up."
        
        followup_date = datetime.utcnow() + timedelta(days=days_from_now)
        followup = schemas.FollowUpCreate(
            interaction_id=interactions[0].id,
            date=followup_date,
            action=action
        )
        created = crud.create_followup(db, followup)
        return f"Follow-up scheduled for Dr. {doctor.name} on {followup_date.strftime('%Y-%m-%d')}. Task: {action}."
    finally:
        db.close()

class RecommendationInput(BaseModel):
    days_ahead: int = Field(description="Number of days to look ahead for recommendations", default=7)

@tool("recommendation", args_schema=RecommendationInput)
def recommendation_tool(days_ahead: int = 7) -> str:
    """Gets recommendations for which doctors to prioritize based on pending tasks."""
    from datetime import datetime, timedelta
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        end_date = now + timedelta(days=days_ahead)
        
        followups = db.query(models.FollowUp).join(models.Interaction).join(models.Doctor).filter(
            models.FollowUp.status == "Pending",
            models.FollowUp.date <= end_date
        ).order_by(models.FollowUp.date.asc()).all()
        
        if not followups:
            return f"No recommendations found for the next {days_ahead} days."
            
        lines = [f"💡 **Recommended Follow-ups (Next {days_ahead} days)**\n"]
        for f in followups:
            doctor_name = f.interaction.doctor.name if f.interaction and f.interaction.doctor else "Unknown Doctor"
            lines.append(f"- **Dr. {doctor_name}** | {f.date.strftime('%d %B %Y')}")
            lines.append(f"  Task: {f.action}")
            lines.append("")
            
        return "\n".join(lines)
    finally:
        db.close()


class GenerateSummaryInput(BaseModel):
    doctor_name: str = Field(description="Doctor name to filter by", default="")
    product: str = Field(description="Product name to filter by", default="")
    hospital: str = Field(description="Hospital name to filter by", default="")
    specialty: str = Field(description="Doctor specialty to filter by", default="")
    period: str = Field(description="Time period (e.g., 'today', 'week', 'month')", default="")

@tool("generate_summary", args_schema=GenerateSummaryInput)
def generate_summary_tool(doctor_name: str = "", product: str = "", hospital: str = "", specialty: str = "", period: str = "") -> str:
    """Fetches interactions based on criteria to generate a summary."""
    from datetime import datetime, timedelta
    db = SessionLocal()
    try:
        query = db.query(models.Interaction).join(models.Doctor)

        if doctor_name:
            query = query.filter(models.Doctor.name.ilike(f"%{doctor_name}%"))
        if hospital:
            query = query.filter(models.Doctor.hospital.ilike(f"%{hospital}%"))
        if specialty:
            query = query.filter(models.Doctor.specialty.ilike(f"%{specialty}%"))
        if product:
            query = query.join(models.interaction_product).join(models.Product).filter(
                models.Product.name.ilike(f"%{product}%")
            )
            
        if period:
            now = datetime.utcnow()
            if period == "today":
                start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
            elif period == "week":
                start_date = now - timedelta(days=7)
            elif period == "month":
                start_date = now - timedelta(days=30)
            else:
                start_date = None
            if start_date:
                query = query.filter(models.Interaction.date >= start_date)

        interactions = query.order_by(models.Interaction.date.desc()).limit(15).all()
        
        if not interactions:
            return "No interactions found matching the criteria to summarize."
            
        summary_lines = []
        for i in interactions:
            product_names = ", ".join([p.name for p in i.products]) if hasattr(i, "products") else "None"
            line = (
                f"Date: {i.date.strftime('%Y-%m-%d')} | Dr. {i.doctor.name} | "
                f"Products: {product_names} | "
                f"Topics: {i.topics} | Sentiment: {i.sentiment} | "
                f"Notes: {i.notes}"
            )
            summary_lines.append(line)
            
        return "\n".join(summary_lines)
    finally:
        db.close()


TOOLS = [
    analytics_tool,
    log_interaction_tool,
    edit_interaction_tool,
    edit_doctor_tool,
    delete_doctor_tool,
    delete_interaction_tool,
    search_hcp_history_tool,
    schedule_followup_tool,
    generate_summary_tool,
    recommendation_tool
]