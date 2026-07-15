import asyncio
from agent.graph import app
from langchain_core.messages import HumanMessage

async def main():
    try:
        config = {"configurable": {"thread_id": "test-123"}}
        result = app.invoke({"messages": [HumanMessage(content="I met Dr Sharma today.")]}, config)
        print("Success:", result)
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
