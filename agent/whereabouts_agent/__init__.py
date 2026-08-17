"""Public package entry point for the Whereabouts generation agent."""

from .contracts import *  # noqa: F401,F403
from .generator import generate_case, generate_from_json

__all__ = ["generate_case", "generate_from_json"]
