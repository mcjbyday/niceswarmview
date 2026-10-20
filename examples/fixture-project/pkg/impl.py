import json

from .base import Base


class Impl(Base):
    def run(self):
        return json.dumps({"ok": True})


def helper(value):
    if value:
        return value * 2
    return 0
