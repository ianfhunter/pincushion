"""Background poller for downloadable Wanted catalogue items."""

from __future__ import annotations

import asyncio
import logging

log = logging.getLogger(__name__)

_POLL_SECONDS = 60


async def wanted_worker_loop(stop: asyncio.Event) -> None:
    from pincushion.services import wanted as wanted_svc

    # Small delay so startup finishes seeding indexers.
    try:
        await asyncio.wait_for(stop.wait(), timeout=5)
        return
    except TimeoutError:
        pass

    while not stop.is_set():
        try:
            results = await wanted_svc.process_queue(limit=2)
            if results:
                log.info("Wanted worker processed %s item(s)", len(results))
        except Exception:
            log.exception("Wanted worker tick failed")
        try:
            await asyncio.wait_for(stop.wait(), timeout=_POLL_SECONDS)
            return
        except TimeoutError:
            continue
