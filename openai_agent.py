"""Run the Grand Alaric MCP tools through an OpenAI agent.

    OPENAI_API_KEY=sk-... python openai_agent.py                      # local, spawns server.py
    MCP_URL=http://host:8000/mcp OPENAI_API_KEY=sk-... python openai_agent.py   # remote server

The agent auto-discovers the tools — no schema duplication. Set OPENAI_MODEL to
override the model (default: gpt-4o).
"""
import asyncio
import os
import sys

from agents import Agent, Runner
from agents.mcp import MCPServerStdio, MCPServerStreamableHttp

INSTRUCTIONS = (
    "You are a hotel concierge for Grand Alaric properties in Bandung, Indonesia. "
    "Use the tools to search hotels and check availability. Once the user confirms "
    "a room and dates, give them the checkout link to complete payment there."
)


def _mcp_server():
    """Remote server if MCP_URL is set, else spawn server.py locally over stdio."""
    url = os.getenv("MCP_URL")
    if url:
        return MCPServerStreamableHttp(name="grand-alaric", params={"url": url})
    return MCPServerStdio(name="grand-alaric", params={"command": sys.executable, "args": ["server.py"]})


async def main() -> None:
    async with _mcp_server() as server:
        agent = Agent(
            name="Concierge",
            instructions=INSTRUCTIONS,
            model=os.getenv("OPENAI_MODEL", "gpt-4o"),
            mcp_servers=[server],
        )
        history: list = []
        print("Grand Alaric Hotel Assistant  |  type 'quit' to exit\n")
        while True:
            user = input("You: ").strip()
            if user.lower() in ("quit", "exit"):
                break
            if not user:
                continue
            result = await Runner.run(agent, history + [{"role": "user", "content": user}])
            print(f"\nAssistant: {result.final_output}\n")
            history = result.to_input_list()


if __name__ == "__main__":
    asyncio.run(main())
