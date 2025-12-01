"""
Simple React Agent for testing LangGraph Studio
"""

import os
from typing import Annotated, Sequence
from typing_extensions import TypedDict

from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from langchain_core.tools import tool
from langchain_core.runnables import RunnableConfig


# =============================================================================
# STATE
# =============================================================================

class AgentState(TypedDict):
    """Simple agent state with messages."""
    messages: Annotated[Sequence[BaseMessage], add_messages]


# =============================================================================
# TOOLS
# =============================================================================

@tool
def get_weather(city: str) -> str:
    """Get the weather for a city."""
    return f"The weather in {city} is sunny and 72°F."


@tool
def search(query: str) -> str:
    """Search for information."""
    return f"Search results for '{query}': This is a mock search result."


@tool
def calculator(expression: str) -> str:
    """Calculate a math expression."""
    try:
        result = eval(expression)
        return f"Result: {result}"
    except:
        return "Could not calculate that expression."


# =============================================================================
# GRAPH
# =============================================================================

def create_simple_graph(config: RunnableConfig | None = None):
    """Create a simple React agent graph."""

    # Initialize LLM via OpenRouter
    llm = ChatOpenAI(
        model=os.getenv("AGENT_MODEL", "x-ai/grok-4.1-fast:free"),
        base_url="https://openrouter.ai/api/v1",
        api_key=os.getenv("OPENROUTER_API_KEY"),
        temperature=0,
    )

    # Tools
    tools = [get_weather, search, calculator]
    llm_with_tools = llm.bind_tools(tools)
    tool_node = ToolNode(tools)

    # Agent node
    def agent(state: AgentState):
        """Call the LLM."""
        messages = state["messages"]
        response = llm_with_tools.invoke(messages)
        return {"messages": [response]}

    # Routing
    def should_continue(state: AgentState):
        """Check if we should continue to tools or end."""
        messages = state["messages"]
        last_message = messages[-1]

        if isinstance(last_message, AIMessage) and last_message.tool_calls:
            return "tools"
        return "end"

    # Build graph
    graph = StateGraph(AgentState)
    graph.add_node("agent", agent)
    graph.add_node("tools", tool_node)

    graph.add_edge(START, "agent")
    graph.add_conditional_edges("agent", should_continue, {"tools": "tools", "end": END})
    graph.add_edge("tools", "agent")

    return graph.compile()


# Entry point for LangGraph Platform
def graph(config: RunnableConfig):
    """Factory function for LangGraph Platform."""
    return create_simple_graph(config)

