import asyncio
from agent.graph import app
from langchain_core.messages import HumanMessage

async def main():
    try:
        config = {"configurable": {"thread_id": "test-fastapi-123"}}
        print("Invoking user's test...")
        result = await app.ainvoke({"messages": [HumanMessage(content="I met Dr Sharma today.  Discussed diabetes medicine.  Shared brochure.  Doctor wants samples.")]}, config)
        print("Final State:", result.get("intents", []), result.get("validation_errors", []), result.get("execution_results", []), result.get("response", ""))
        print("Success!")
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
