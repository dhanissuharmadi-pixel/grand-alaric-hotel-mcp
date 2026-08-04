"""Booking-path routing check: a tagged hotel_id must point _api at the right tenant.
Run: uv run python test_routing.py"""
import server

server.TENANTS = {"vie": "https://vie.example", "ga": "https://ga.example"}

server._current_base.set("default")
assert server._route("vie:AJOW") == "AJOW"
assert server._current_base.get() == "https://vie.example"  # booking would hit vie

assert server._route("ga:GSV") == "GSV"
assert server._current_base.get() == "https://ga.example"  # ...and this hits ga

assert server._route("PLAIN") == "PLAIN"          # untagged: unchanged
assert server._route("unknown:X") == "unknown:X"  # unknown slug: not routed, left intact

print("routing ok")
