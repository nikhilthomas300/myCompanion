from __future__ import annotations

import asyncio


class InterruptFlag:
    """Global interrupt flag that can be awaited by long-running flows."""

    def __init__(self) -> None:
        self._event = asyncio.Event()

    def trigger(self) -> None:
        self._event.set()

    def clear(self) -> None:
        self._event.clear()

    def is_triggered(self) -> bool:
        return self._event.is_set()

    async def wait(self) -> None:
        await self._event.wait()


interrupt_flag = InterruptFlag()
