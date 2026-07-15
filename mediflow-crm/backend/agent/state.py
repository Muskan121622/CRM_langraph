from typing import TypedDict, Annotated, Sequence
import operator
from langchain_core.messages import BaseMessage

class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], operator.add]
    intents: list[str]
    entities: dict
    validation_errors: Annotated[list[str], operator.add]
    execution_results: Annotated[list[str], operator.add]
    response: str
    conversation_id: str
    user_id: str
    timestamp: str
