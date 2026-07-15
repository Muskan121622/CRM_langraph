import os
from enum import Enum
from typing import List
from dotenv import load_dotenv

from langgraph.graph import StateGraph, END
from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from pydantic import BaseModel, Field

from .state import AgentState
from .tools import (
    log_interaction_tool, 
    edit_interaction_tool, 
    search_hcp_history_tool, 
    schedule_followup_tool, 
    generate_summary_tool,
    delete_interaction_tool,
    edit_doctor_tool,
    delete_doctor_tool,
    analytics_tool,
    recommendation_tool
)

load_dotenv()

# Initialize LLM
llm = ChatGroq(model="llama-3.1-8b-instant", api_key=os.getenv("GROQ_API_KEY"))

# Enum for Intents
class Intent(str, Enum):
    LOG = "log"
    EDIT = "edit"
    SEARCH = "search"
    FOLLOWUP = "followup"
    SUMMARY = "summary"
    DELETE = "delete"
    GENERAL = "general"
    ANALYTICS = "analytics"
    RECOMMENDATION = "recommendation"

from typing import List, Dict

# ...

# Structured Output Schema
class InteractionExtraction(BaseModel):
    intents: List[Intent] = Field(description="The user's intents. Can be multiple.")
    doctor_name: str = Field(default="", description="Name of the doctor. ALWAYS prefix with 'Dr. ' (e.g. 'Dr. Muskan', 'Dr. Priya Nair')")
    hospital: str = Field(default="", description="Hospital or clinic name")
    specialty: str = Field(default="", description="Specialty of the doctor")
    interaction_type: str = Field(default="meeting", description="Type of interaction (e.g. meeting, call)")
    topics: str = Field(default="", description="Medical or professional topics discussed (e.g. hypertension, heart failure, fever management). Do NOT include product names here.")
    products: str = Field(default="", description="Products discussed")
    materials_shared: List[str] = Field(default_factory=list, description="List of materials shared (e.g. ['brochure', 'slides'])")
    samples_distributed: int = Field(default=0, description="Number of samples given to the doctor during this visit")
    samples_requested: int = Field(default=0, description="Number of samples the doctor requested for the future")
    sentiment: str = Field(default="", description="Sentiment of the meeting (Positive, Negative, Neutral). If the doctor asks for samples, infer Positive sentiment.")
    notes: str = Field(default="", description="A professional, multi-sentence executive summary of the meeting (e.g. 'Discussed diabetes medicine. Shared brochure. Doctor requested product samples. Representative should revisit.')")
    action: str = Field(default="", description="Action to take in follow-up. MUST be filled if a follow-up date is mentioned (e.g. 'Meeting after 2 weeks').")
    days_from_now: int = Field(default=7, description="Number of days from now to schedule")
    interaction_id: int = Field(default=0, description="ID of the interaction to edit or summarize")
    entity_type: str = Field(default="interaction", description="When editing, specify if editing a 'doctor' profile or an 'interaction'. Default is 'interaction'")
    old_doctor_name: str = Field(default="", description="When editing a doctor profile, the old name of the doctor. ALWAYS prefix with 'Dr. '")
    new_doctor_name: str = Field(default="", description="When editing a doctor profile, the new name of the doctor. ALWAYS prefix with 'Dr. '")
    delete_all: bool = Field(default=False, description="Set to true if the user explicitly asks to delete ALL interactions for a doctor")
    suggested_followups: List[str] = Field(default_factory=list, description="Generate 3 highly contextual suggested follow-up tasks based on the specific product, disease, and specialty discussed.")
    suggested_materials: List[str] = Field(default_factory=list, description="Generate 3 highly contextual suggested medical materials (e.g., specific clinical study titles, brochures, or dosage charts) to share with the doctor based on the topics and products discussed.")
    confidence_scores: str = Field(default="", description="A string showing AI confidence percentages, e.g. 'Doctor: 99%, Hospital: 95%, Product: 99%, Sentiment: 95%, Follow-up: 90%'")
    metric: str = Field(default="", description="For analytics: Metric to aggregate (e.g., 'samples_requested', 'samples_distributed', 'visits', 'products', 'meetings', 'sentiment')")
    group_by: str = Field(default="", description="For analytics: Entity to group by (e.g., 'doctor', 'hospital', 'product', 'specialty')")
    operator: str = Field(default="", description="For analytics: Operator for filtering numeric metrics (e.g., '>', '<', '=', '>=', '<=')")
    threshold: int = Field(default=0, description="For analytics: Numeric threshold for the operator")
    value: str = Field(default="", description="For analytics: String value to filter by (e.g., 'Positive' for sentiment)")
    period: str = Field(default="", description="For analytics: Time period (e.g., 'today', 'week', 'month')")

# Node 1: Extract Intent and Entities
def extract_node(state: AgentState):
    messages = state.get("messages", [])
    history = [m for m in messages[-3:] if isinstance(m, (HumanMessage, AIMessage))]
    
    prompt = SystemMessage(content="""You are MediFlow AI, an intelligent CRM assistant for Medical Reps.
Extract the user's intent and any relevant entities FROM THE LATEST USER MESSAGE.
Use the conversation history ONLY for context (e.g. if the user says "update my last interaction"). 
If the latest message describes a NEW meeting, completely IGNORE all past doctors and search results in the history.
If a field is not mentioned in the latest message, leave it empty (or -1 for samples_distributed and samples_requested).

Intents:
- 'log': The user is describing a meeting or interaction they just had with a doctor. Note: 'Doctor wants samples' is just a note for the meeting log (samples_requested=True), NOT a followup!
- 'edit': The user wants to update a past meeting record.
- 'edit': The user wants to update/edit/change/rename an existing interaction or a doctor's profile.
- 'delete': The user wants to delete an interaction record or all interactions for a doctor.
- 'search': The user wants to search/find/show past interactions — by doctor name, product, hospital, specialty, sentiment, or any combination.
- 'analytics': The user asks for aggregated data, e.g., doctors requesting >20 sample kits, top products, sentiment counts, etc.
- 'followup': The user explicitly asks to schedule a reminder, book another appointment, or follow-up for a future date. If they say "wants another meeting in 2 weeks", that is a followup intent!
- 'recommendation': The user wants recommendations on who to prioritize or see their scheduled follow-ups, e.g. "Which doctors should I prioritize for follow-up next week?" or "Recommend who to visit".
- 'summary': The user wants a summary of meetings. This could be for a specific doctor, product, hospital, or over a time period (e.g., "Summarize all meetings this week", "Summarize my meetings about MedFlow").
- 'general': General chat or greetings.

CRITICAL INSTRUCTIONS:
1. Write a professional executive summary in the `notes` field describing the entire interaction.
2. SAMPLES RULE — READ CAREFULLY: There are TWO separate fields: `samples_distributed` (physically handed over TODAY) and `samples_requested` (doctor asked for future delivery).
   - If the user says "I distributed/gave/handed X samples" → set `samples_distributed=X`
   - If the user says "doctor requested/asked for X samples" → set `samples_requested=X`, and `samples_distributed=0` unless explicitly stated otherwise.
   - NEVER copy the same number into both fields unless the user explicitly says they both gave AND the doctor also requested separately.
   - Example: "He requested 18 starter sample kits" → `samples_distributed=0, samples_requested=18`. NOT both 18.
3. If the user mentions sharing materials (e.g. "I shared the product brochure"), you MUST extract them into `materials_shared` as a list of strings.
4. **CRITICAL**: If the user mentions ANY follow-up (e.g. "meeting next month", "email evidence", "follow up in 2 weeks"), you MUST extract it into the `action` field AND estimate `days_from_now`. Do NOT just hide it in the summary.
5. Generate exactly 3 `suggested_followups` based specifically on the product and context discussed.
6. Provide a realistic `confidence_scores` string formatting for key fields (e.g. "Doctor: 99%, Hospital: 95%, Product: 99%, Sentiment: 95%, Follow-up: 90%").
7. If the user says "delete all" for a specific doctor, set the `delete_all` boolean to true.
8. If the user wants to edit ANY field of a doctor profile (rename, change hospital, change specialty), set intent="edit", `entity_type`="doctor", and `old_doctor_name`=the current doctor name. For a rename also set `new_doctor_name`. For hospital change set `hospital`=new hospital. For specialty change set `specialty`=new specialty. Example: 'Update Dr. Priya Nair hospital to Medanta' → entity_type='doctor', old_doctor_name='Dr. Priya Nair', hospital='Medanta'.
9. If the user wants to delete a doctor entirely (e.g., "delete dr muskan"), set intent="delete", `entity_type`="doctor", and `doctor_name` to the doctor.
10. NEVER refuse to log an interaction. If information is missing (like sentiment or topics), just leave it blank or use neutral defaults. DO NOT ask the user for more information. ALWAYS output valid JSON.
11. INTERACTION FIELD EDIT RULE: If the user wants to update/correct/change any field of a past meeting (materials shared, samples distributed, samples requested, topics, sentiment, notes/summary, interaction type) for a specific doctor, set intent="edit", `entity_type`="interaction", `doctor_name`=the doctor's name, and fill ONLY the fields the user mentioned changing. Leave all other fields empty/default so they are NOT overwritten.
    - Example: "Update materials for Dr. Priya Nair to brochure and guide" → entity_type='interaction', doctor_name='Dr. Priya Nair', materials_shared=['brochure', 'guide']
    - Example: "Change samples distributed for Dr. Karan to 5" → entity_type='interaction', doctor_name='Dr. Karan Malhotra', samples_distributed=5
    - Example: "Update sentiment for Dr. Sneha to Positive" → entity_type='interaction', doctor_name='Dr. Sneha Kapoor', sentiment='Positive'
12. For 'analytics', extract metric, operator, value, and group_by fields clearly.
""")
    extractor = llm.with_structured_output(InteractionExtraction)
    
    try:
        result = extractor.invoke([prompt] + history)
        return {"intents": [i.value for i in result.intents], "entities": result.dict()}
    except Exception as e:
        return {"intents": ["general"], "entities": {}, "validation_errors": [f"Parsing error: {str(e)}"]}

# Node 2: Validation Node
def validation_node(state: AgentState):
    intents = state.get("intents", [])
    entities = state.get("entities", {})
    errors = []
    valid_intents = []

    if "log" in intents:
        if not entities.get("doctor_name"):
            errors.append("Missing Doctor Name for logging.")
        else:
            valid_intents.append("log")
            
    if "edit" in intents:
        if entities.get("entity_type") == "doctor":
            # Accept either old_doctor_name (for renames) or doctor_name (for field edits)
            if not entities.get("old_doctor_name") and not entities.get("doctor_name"):
                errors.append("Missing Doctor Name for editing doctor profile.")
            else:
                valid_intents.append("edit")
        else:
            if not entities.get("interaction_id") and not entities.get("doctor_name"):
                errors.append("Missing Interaction ID or Doctor Name for editing interaction.")
            else:
                valid_intents.append("edit")
            
    if "delete" in intents:
        if not entities.get("interaction_id") and not entities.get("doctor_name"):
            errors.append("Missing Interaction ID or Doctor Name for deleting.")
        else:
            valid_intents.append("delete")
            
    if "search" in intents:
        has_criteria = (entities.get("doctor_name") or entities.get("products") or
                        entities.get("hospital") or entities.get("specialty") or entities.get("sentiment"))
        if not has_criteria:
            errors.append("Missing search criteria. Provide a doctor name, product, hospital, specialty, or sentiment.")
        else:
            valid_intents.append("search")
            
    if "analytics" in intents:
        # Require metric and group_by for analytics queries
        required = ["metric", "group_by"]
        missing = [k for k in required if not entities.get(k)]
        if missing:
            errors.append(f"Missing analytics fields: {', '.join(missing)}")
        else:
            valid_intents.append("analytics")
            
    if "followup" in intents:
        if not entities.get("doctor_name") or not entities.get("action"):
            errors.append("Missing explicit Follow-up Action or Doctor Name.")
        else:
            valid_intents.append("followup")
            
    if "recommendation" in intents:
        valid_intents.append("recommendation")
            
    if "summary" in intents:
        # Check if they provided some criteria to summarize
        if not (entities.get("doctor_name") or entities.get("products") or entities.get("hospital") or entities.get("specialty") or entities.get("period")):
            errors.append("Missing criteria for summary. Provide a doctor, product, hospital, specialty, or period.")
        else:
            valid_intents.append("summary")
            
    if "general" in intents:
        valid_intents.append("general")

    if not valid_intents and not errors:
        valid_intents.append("general")

    return {"validation_errors": errors, "intents": valid_intents}

# Router Node (Conditional Edge logic)
def route_intent(state: AgentState) -> List[str]:
    intents = state.get("intents", [])
    
    if not intents and state.get("validation_errors"):
        return ["nlg"]
        
    routes = []
    for intent in intents:
        if intent in ["log", "edit", "delete", "search", "summary", "general", "analytics", "recommendation"]:
            routes.append(intent)
        elif intent == "followup" and "log" not in intents:
            routes.append("followup")
            
    if not routes:
        routes.append("general")
        
    return routes

# Execution Nodes (Tools called deterministically via Python)
def log_interaction_node(state: AgentState):
    ent = state.get("entities", {})
    res = log_interaction_tool.invoke({
        "doctor_name": ent.get("doctor_name"),
        "hospital": ent.get("hospital", ""),
        "specialty": ent.get("specialty", ""),
        "interaction_type": ent.get("interaction_type", "meeting"),
        "topics": ent.get("topics", ""),
        "products": ent.get("products", ""),
        "materials": ", ".join(ent.get("materials_shared", [])) if isinstance(ent.get("materials_shared"), list) else ent.get("materials_shared", ""),
        "samples_distributed": 0 if ent.get("samples_distributed", -1) == -1 else ent.get("samples_distributed", 0),
        "samples_requested": 0 if ent.get("samples_requested", -1) == -1 else ent.get("samples_requested", 0),
        "sentiment": ent.get("sentiment") or "Neutral",
        "notes": ent.get("notes", ""),
        "action": ent.get("action", ""),
        "days_from_now": ent.get("days_from_now", 7)
    })
    return {"execution_results": [res]}

def edit_interaction_node(state: AgentState):
    ent = state.get("entities", {})
    entity_type = ent.get("entity_type", "interaction")
    
    if entity_type == "doctor":
        # Use old_doctor_name for renames, or doctor_name for field-only edits
        lookup_name = ent.get("old_doctor_name") or ent.get("doctor_name", "")
        res = edit_doctor_tool.invoke({
            "old_name": lookup_name,
            "new_name": ent.get("new_doctor_name", ""),
            "specialty": ent.get("specialty", ""),
            "hospital": ent.get("hospital", "")
        })
    else:
        res = edit_interaction_tool.invoke({
            "interaction_id": ent.get("interaction_id", 0),
            "doctor_name": ent.get("doctor_name", ""),
            "interaction_type": ent.get("interaction_type", ""),
            "topics": ent.get("topics", ""),
            "materials": ", ".join(ent.get("materials_shared", [])) if isinstance(ent.get("materials_shared"), list) else ent.get("materials_shared", ""),
            "samples_distributed": ent.get("samples_distributed", -1),
            "samples_requested": ent.get("samples_requested", -1),
            "sentiment": ent.get("sentiment", ""),
            "notes": ent.get("notes", "")
        })
    return {"execution_results": [res]}

def delete_interaction_node(state: AgentState):
    ent = state.get("entities", {})
    entity_type = ent.get("entity_type", "interaction")
    
    if entity_type == "doctor":
        res = delete_doctor_tool.invoke({
            "doctor_name": ent.get("doctor_name", "")
        })
    else:
        res = delete_interaction_tool.invoke({
            "interaction_id": ent.get("interaction_id", 0),
            "doctor_name": ent.get("doctor_name", ""),
            "delete_all": ent.get("delete_all", False)
        })
    return {"execution_results": [res]}

def search_node(state: AgentState):
    ent = state.get("entities", {})
    res = search_hcp_history_tool.invoke({
        "doctor_name": ent.get("doctor_name", ""),
        "product":     ent.get("products", ""),
        "hospital":    ent.get("hospital", ""),
        "specialty":   ent.get("specialty", ""),
        "sentiment":   ent.get("sentiment", ""),
    })
    return {"execution_results": [res]}

def analytics_node(state: AgentState):
    ent = state.get("entities", {})
    res = analytics_tool.invoke({
        "metric": ent.get("metric", "visits"),
        "group": ent.get("group_by", "doctor"),
        "operator": ent.get("operator", ""),
        "threshold": ent.get("threshold"),
        "value": ent.get("value", ""),
        "period": ent.get("period", "")
    })
    return {"execution_results": [res]}

def schedule_node(state: AgentState):
    ent = state.get("entities", {})
    res = schedule_followup_tool.invoke({
        "doctor_name": ent.get("doctor_name"),
        "action": ent.get("action"),
        "days_from_now": ent.get("days_from_now", 7)
    })
    return {"execution_results": [res]}

def recommendation_node(state: AgentState):
    ent = state.get("entities", {})
    # Default to 7 days if they didn't specify a large period.
    days_ahead = 7
    if ent.get("period") == "month": days_ahead = 30
    elif ent.get("period") == "today": days_ahead = 1
    elif ent.get("days_from_now") and ent.get("days_from_now") != 7: days_ahead = ent.get("days_from_now")
    
    res = recommendation_tool.invoke({"days_ahead": days_ahead})
    return {"execution_results": [res]}

def summary_node(state: AgentState):
    ent = state.get("entities", {})
    res = generate_summary_tool.invoke({
        "doctor_name": ent.get("doctor_name", ""),
        "product": ent.get("products", ""),
        "hospital": ent.get("hospital", ""),
        "specialty": ent.get("specialty", ""),
        "period": ent.get("period", "")
    })
    return {"execution_results": [res]}

def general_node(state: AgentState):
    return {"execution_results": []}

# Post-Execution Router: Decide whether to use NLG or skip it
def route_after_execution(state: AgentState) -> str:
    # Always route to NLG for Microsoft Copilot style confirmation
    return "nlg"

# Node 3: Natural Language Generator (NLG)
def nlg_node(state: AgentState):
    user_msg = state["messages"][-1].content
    errors = state.get("validation_errors", [])
    exec_results = state.get("execution_results", [])
    ent = state.get("entities", {})
    
    if not exec_results and errors:
        error_msg = " ".join(errors)
        prompt = SystemMessage(content=f"You are MediFlow AI. Tell the user politely that you are missing required information to complete their request: {error_msg}")
        reply = llm.invoke([prompt, HumanMessage(content=user_msg)])
        return {"messages": [reply], "response": reply.content}
    elif not exec_results:
        prompt = SystemMessage(content="You are MediFlow AI. Answer the user's general query politely.")
        reply = llm.invoke([prompt, HumanMessage(content=user_msg)])
        return {"messages": [reply], "response": reply.content}
    
    # Check if it was a search or summary, which need conversational generation
    intents = state.get("intents", [])
    
    if "delete" in intents:
        doc_name = ent.get("doctor_name", "Unknown")
        res_str = " ".join(exec_results)
        if "deleted successfully" in res_str:
            if "Doctor profile" in res_str:
                copilot_msg = f"✅ {res_str}"
            elif "interactions for" in res_str:
                copilot_msg = f"✅ {res_str}"
            else:
                import re
                match = re.search(r"Interaction (\d+)", res_str)
                iid = match.group(1) if match else "Unknown"
                copilot_msg = f"✅ Duplicate record deleted successfully.\n\n**Deleted:**\n- **Doctor**: {doc_name}\n- **ID**: {iid}"
        else:
            copilot_msg = f"❌ {res_str}"
            
        reply = AIMessage(content=copilot_msg)
        return {"messages": [reply], "response": reply.content}
        
    if "edit" in intents:
        if ent.get("entity_type") == "doctor":
            lookup_name = ent.get("old_doctor_name") or ent.get("doctor_name", "Unknown")
            res_str = " ".join(exec_results)
            if "updated successfully" in res_str:
                changes = []
                if ent.get("new_doctor_name"): changes.append(f"- **Name**: {lookup_name} → {ent.get('new_doctor_name')}")
                if ent.get("hospital"): changes.append(f"- **Hospital**: updated to {ent.get('hospital')}")
                if ent.get("specialty"): changes.append(f"- **Specialty**: updated to {ent.get('specialty')}")
                changes_str = "\n".join(changes) if changes else f"- **Doctor**: {lookup_name}"
                copilot_msg = f"✅ Doctor profile updated successfully.\n\n**Updated:**\n{changes_str}"
            else:
                copilot_msg = f"❌ {res_str}"
        else:
            doc_name = ent.get("doctor_name", "Unknown")
            res_str = " ".join(exec_results)
            if "updated successfully" in res_str:
                import re
                match = re.search(r"Interaction (\d+)", res_str)
                iid = match.group(1) if match else "Unknown"
                copilot_msg = f"✅ Interaction record updated successfully.\n\n**Updated:**\n- **Doctor**: {doc_name}\n- **ID**: {iid}"
            else:
                copilot_msg = f"❌ {res_str}"
        
        reply = AIMessage(content=copilot_msg)
        return {"messages": [reply], "response": reply.content}

    if "search" in intents or "analytics" in intents or "recommendation" in intents:
        res_str = "\n".join(exec_results)
        reply = AIMessage(content=res_str)
        return {"messages": [reply], "response": reply.content}
        
    if "summary" in intents:
        combined_results = "\n".join(exec_results)
        prompt = SystemMessage(content=f"""You are MediFlow AI. Based on the following database execution results, provide a highly structured, professional bulleted summary. 

Follow this EXACT format:
📋 **Executive Summary**

• **Doctor(s) / Context**: (Briefly state who or what this summary is about)
• **Key Topics**: (Summarize the main medical topics and products discussed)
• **Highlights**: (Summarize sentiment, materials shared, samples requested/distributed, and any notable feedback)
• **Next Actions**: (List any upcoming follow-ups or pending actions)

If summarizing multiple meetings, synthesize the information cohesively rather than listing them one by one.

Results:
{combined_results}""")
        reply = llm.invoke([prompt])
        return {"messages": [reply], "response": reply.content}

    if "followup" in intents and "log" not in intents:
        res_str = "\n".join(exec_results)
        copilot_msg = f"✅ {res_str}" if "scheduled" in res_str.lower() else f"❌ {res_str}"
        reply = AIMessage(content=copilot_msg)
        return {"messages": [reply], "response": reply.content}

    # Deterministic Copilot-Style Output for logs
    docs = ent.get("doctor_name", "Unknown")
    hosp = ent.get("hospital", "Not specified")
    prod = ent.get("products", "Not specified")
    mats = ent.get("materials_shared", [])
    if isinstance(mats, list):
        mats_display = ", ".join(mats) if mats else "None"
    else:
        mats_display = mats if mats else "None"
    
    samp_dist = ent.get("samples_distributed", 0)
    samp_req = ent.get("samples_requested", 0)
    
    samp_display = f"{samp_dist} distributed"
    if samp_req > 0:
        samp_display += f", {samp_req} requested"
        
    sent = ent.get("sentiment", "Neutral")
    act = ent.get("action") or "None"
    
    conf_scores = ent.get("confidence_scores", "")
    
    copilot_msg = f"""✅ **AI extracted the following information**

- **Doctor**: ✔ {docs}
- **Hospital**: ✔ {hosp}
- **Product**: ✔ {prod}
- **Materials**: ✔ {mats_display}
- **Samples**: ✔ {samp_display}
- **Sentiment**: ✔ {sent}
- **Follow-up**: ✔ {act}

**AI Confidence**
{conf_scores}

*Extracted Using: LangGraph ↓ Structured Output ↓ Validation ↓ Executed Tools*"""

    reply = AIMessage(content=copilot_msg)
    return {"messages": [reply], "response": reply.content}


# Build the Graph
workflow = StateGraph(AgentState)

workflow.add_node("extract", extract_node)
workflow.add_node("validate", validation_node)

# Execution Nodes
workflow.add_node("log", log_interaction_node)
workflow.add_node("edit", edit_interaction_node)
workflow.add_node("delete", delete_interaction_node)
workflow.add_node("search", search_node)
workflow.add_node("analytics", analytics_node)
workflow.add_node("followup", schedule_node)
workflow.add_node("recommendation", recommendation_node)
workflow.add_node("summary", summary_node)
workflow.add_node("general", general_node)

# Response Node
workflow.add_node("nlg", nlg_node)

# Edges
workflow.set_entry_point("extract")
workflow.add_edge("extract", "validate")

workflow.add_conditional_edges("validate", route_intent, ["log", "edit", "delete", "search", "followup", "summary", "general", "analytics", "recommendation", "nlg"])

# Fan-in conditionally
for node in ["log", "edit", "delete", "search", "followup", "summary", "general", "analytics", "recommendation"]:
    workflow.add_conditional_edges(
        node, 
        route_after_execution, 
        {"nlg": "nlg", "end": END}
    )

workflow.add_edge("nlg", END)

from langgraph.checkpoint.memory import MemorySaver

# Compile with memory
memory = MemorySaver()
app = workflow.compile(checkpointer=memory)
