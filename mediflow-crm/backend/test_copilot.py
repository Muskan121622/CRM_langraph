import asyncio
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from agent.graph import app
from langchain_core.messages import HumanMessage, AIMessage

async def main():
    history = [
        HumanMessage(content="Show all my interactions with Dr. Priya Nair during the last six months."),
        AIMessage(content="🔍 **Search Results**\n\nFound 1 interactions with Dr. Priya Nair..."),
        HumanMessage(content="Generate a concise summary of my last meeting with Dr. Anita Verma highlighting the products discussed, doctor's feedback, materials shared, and next steps."),
        AIMessage(content="It looks like we found one recent interaction with Dr. Priya Nair from Apollo Hospital...")
    ]
    user_msg = "I met Dr. Anita Verma, an Endocrinologist at Apollo Hospital today. We discussed GlucoCare XR for Type 2 Diabetes management and reviewed the latest Phase III clinical trial results. She was highly impressed with the efficacy and safety profile. I shared the product brochure, dosage guide, and clinical trial publication. She requested 20 starter sample kits for eligible patients and asked me to schedule another meeting after two weeks to discuss patient feedback. Overall, she showed strong interest in prescribing GlucoCare XR."
    
    print("Testing prompt...")
    state = {"messages": history + [HumanMessage(content=user_msg)]}
    config = {"configurable": {"thread_id": "test_copilot_1"}}
    
    result = await app.ainvoke(state, config=config)
    
    print("----- EXTRACTED ENTITIES -----")
    print(result.get("entities", {}))
    print("\n----- VALIDATION ERRORS -----")
    print(result.get("validation_errors", []))
    print("\n----- COPILOT RESPONSE -----")
    print(result.get("response", ""))

if __name__ == "__main__":
    asyncio.run(main())
