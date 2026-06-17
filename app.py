"""Browser chat UI for the Grand Alaric concierge (Gradio + OpenAI Agents SDK).

    OPENAI_API_KEY=sk-... python app.py                       # local, spawns server.py
    MCP_URL=https://<app>.onrender.com/sse?token=... \
        OPENAI_API_KEY=sk-... python app.py                   # hosted SSE server

Set GRAND_ALARIC_API_KEY too (local mode) for live hotel data; otherwise mock.
"""
import os
import sys

import gradio as gr
from agents import Agent, Runner
from agents.mcp import MCPServerSse, MCPServerStdio

INSTRUCTIONS = (
    "You are a hotel concierge for Grand Alaric properties in Bandung, Indonesia. "
    "Use the tools to search hotels, check availability, and (after the user gives "
    "guest details) place an order, then share the payment link. Dates are DD-MM-YYYY."
)

# Hosted SSE server if MCP_URL is set, else spawn server.py locally over stdio.
_url = os.getenv("MCP_URL")
_server = (MCPServerSse(name="grand-alaric", params={"url": _url}) if _url
           else MCPServerStdio(name="grand-alaric", params={"command": sys.executable, "args": ["server.py"]}))
_agent = None


async def respond(message, history):
    global _agent
    if _agent is None:  # connect once, on first message
        await _server.connect()
        _agent = Agent(name="Concierge", instructions=INSTRUCTIONS,
                       model=os.getenv("OPENAI_MODEL", "gpt-4o"), mcp_servers=[_server])
    result = await Runner.run(_agent, history + [{"role": "user", "content": message}])
    return result.final_output


demo = gr.ChatInterface(
    respond,
    title="Grand Alaric Concierge",
    description="Search hotels, check rooms, and book — powered by the Grand Alaric MCP.",
    examples=["Find me a room in Bandung", "What rooms are at GSV on 20-06-2026 to 21-06-2026?"],
)

if __name__ == "__main__":
    demo.launch(server_name=os.getenv("HOST", "127.0.0.1"), server_port=int(os.getenv("PORT", "7860")))
