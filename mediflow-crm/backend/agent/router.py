from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from .graph import app
from langchain_core.messages import HumanMessage
import uuid

router = APIRouter()

from pydantic import BaseModel, Field

class ChatRequest(BaseModel):
    message: str
    thread_id: str = Field(default_factory=lambda: str(uuid.uuid4()))

class ChatResponse(BaseModel):
    response: str
    thread_id: str
    entities: dict = {}

@router.post("/chat", response_model=ChatResponse)
async def chat_with_agent(request: ChatRequest):
    thread_id = request.thread_id
    
    # Invoke agent with only the new message
    config = {"configurable": {"thread_id": thread_id}}
    
    result = await app.ainvoke({"messages": [HumanMessage(content=request.message)]}, config)
    
    # If we skipped the NLG node, format the execution results directly!
    if "response" in result and result["response"]:
        ai_message = result["response"]
    elif "execution_results" in result and result["execution_results"]:
        ai_message = "✅ " + " | ".join(result["execution_results"])
    else:
        ai_message = "Interaction extracted successfully. Would you like to save this interaction?"
    
    return ChatResponse(
        response=ai_message, 
        thread_id=thread_id,
        entities=result.get("entities", {})
    )
