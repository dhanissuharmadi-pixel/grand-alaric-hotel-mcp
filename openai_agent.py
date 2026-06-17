"""Run the Grand Alaric MCP tools through an OpenAI agent.

    OPENAI_API_KEY=sk-... python openai_agent.py

The agent auto-discovers the tools from server.py over stdio — no schema
duplication. Set OPENAI_MODEL to override the model (default: gpt-4o).
"""
import asyncio
import os
import sys

from agents import Agent, Runner
from agents.mcp import MCPServerStdio

INSTRUCTIONS = (
    "You are a hotel concierge for Grand Alaric properties in Bandung, Indonesia. "
    "Use the tools to search hotels and check availability. Once the user confirms "
    "a room and dates, give them the checkout link to complete payment there."
)


async def main() -> None:
    # Spawns server.py as a stdio MCP subprocess; the agent lists its tools on connect.
    async with MCPServerStdio(
        name="grand-alaric",
        params={"command": sys.executable, "args": ["server.py"]},
    ) as server:
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
