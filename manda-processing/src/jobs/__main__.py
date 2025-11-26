"""
Entry point for running the worker as a module.
Usage: python -m src.jobs
"""

import asyncio

from src.jobs.worker import get_worker, run_worker, setup_default_handlers


def main() -> None:
    """Main entry point for the worker process."""
    worker = get_worker()
    setup_default_handlers(worker)
    asyncio.run(run_worker())


if __name__ == "__main__":
    main()
