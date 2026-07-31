"""Read-only Xquik activity data for the Hermes Dashboard.

Mounted at ``/api/plugins/xquik-activity/`` by Hermes. The Xquik API key stays
in this server-side module and is never returned to the browser.
"""

from __future__ import annotations

import json
import os
from collections.abc import Callable
from json import JSONDecodeError
from typing import Annotated, Any
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import HTTPRedirectHandler, Request, build_opener

from fastapi import APIRouter, Depends, HTTPException

router = APIRouter()

XQUIK_API_BASE = "https://xquik.com/api/v1"
XQUIK_API_KEY_ENV = "XQUIK_API_KEY"
MAX_RESPONSE_BYTES = 1_000_000
READ_ONLY_PATHS = frozenset(
    {"/account", "/credits", "/events", "/monitors", "/monitors/keywords"}
)


class NoRedirectHandler(HTTPRedirectHandler):
    """Keep the API key on the fixed Xquik origin."""

    def redirect_request(
        self,
        request: Request,
        file_pointer: Any,
        code: int,
        message: str,
        headers: Any,
        new_url: str,
    ) -> None:
        return None


DEFAULT_OPENER = build_opener(NoRedirectHandler()).open


class XquikClient:
    """Small allow-listed client for Xquik's read-only dashboard endpoints."""

    def __init__(
        self,
        api_key: str,
        opener: Callable[..., Any] = DEFAULT_OPENER,
    ) -> None:
        self._api_key = api_key
        self._opener = opener

    def get_json(
        self,
        path: str,
        query: dict[str, str | int] | None = None,
    ) -> dict[str, Any]:
        """Return one allow-listed JSON object without exposing credentials."""
        if path not in READ_ONLY_PATHS:
            raise ValueError(f"Unsupported Xquik path: {path}")

        url = f"{XQUIK_API_BASE}{path}"
        if query:
            url = f"{url}?{urlencode(query)}"

        request = Request(
            url,
            headers={
                "Accept": "application/json",
                "x-api-key": self._api_key,
            },
            method="GET",
        )

        try:
            with self._opener(request, timeout=10) as response:
                body = response.read(MAX_RESPONSE_BYTES + 1)
        except HTTPError as error:
            if error.code == 401:
                message = "Xquik rejected the configured API key. Check XQUIK_API_KEY."
            elif error.code == 429:
                message = "Xquik rate limit reached. Try again later."
            else:
                message = "Xquik request failed. Try again later."
            raise HTTPException(status_code=502, detail=message) from error
        except OSError as error:
            raise HTTPException(
                status_code=502,
                detail="Xquik is unavailable. Try again later.",
            ) from error

        if len(body) > MAX_RESPONSE_BYTES:
            raise HTTPException(
                status_code=502,
                detail="Xquik returned an unexpectedly large response.",
            )

        try:
            payload = json.loads(body)
        except (JSONDecodeError, UnicodeDecodeError) as error:
            raise HTTPException(
                status_code=502,
                detail="Xquik returned an invalid response.",
            ) from error

        if not isinstance(payload, dict):
            raise HTTPException(
                status_code=502,
                detail="Xquik returned an invalid response.",
            )
        return payload


def get_xquik_client() -> XquikClient:
    """Build a client from the server environment."""
    api_key = os.environ.get(XQUIK_API_KEY_ENV, "").strip()
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="Xquik is not configured. Set XQUIK_API_KEY first.",
        )
    return XquikClient(api_key)


def _text(value: Any, limit: int = 200) -> str | None:
    return value[:limit] if isinstance(value, str) else None


def _integer(value: Any) -> int | None:
    return value if isinstance(value, int) and not isinstance(value, bool) else None


def _monitor_summary(value: Any, monitor_type: str) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None
    raw_event_types = value.get("eventTypes", [])
    event_types = (
        [item[:100] for item in raw_event_types[:20] if isinstance(item, str)]
        if isinstance(raw_event_types, list)
        else []
    )
    return {
        "id": _text(value.get("id")),
        "monitorType": monitor_type,
        "username": _text(value.get("username")),
        "query": _text(value.get("query")),
        "eventTypes": event_types,
        "isActive": value.get("isActive") is True,
        "nextBillingAt": _text(value.get("nextBillingAt")),
    }


def _event_summary(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None
    return {
        "id": _text(value.get("id")),
        "type": _text(value.get("type")),
        "username": _text(value.get("username")),
        "query": _text(value.get("query")),
        "monitorType": _text(value.get("monitorType")),
        "occurredAt": _text(value.get("occurredAt")),
    }


@router.get("/overview")
def get_overview(
    client: Annotated[XquikClient, Depends(get_xquik_client)],
) -> dict[str, Any]:
    """Return the small read-only dataset rendered by the dashboard plugin."""
    account = client.get_json("/account")
    credits = client.get_json("/credits")
    account_monitor_response = client.get_json("/monitors")
    keyword_monitor_response = client.get_json("/monitors/keywords")
    event_response = client.get_json("/events", {"limit": 10})

    raw_account_monitors = account_monitor_response.get("monitors", [])
    account_monitors = (
        [
            summary
            for item in raw_account_monitors[:100]
            if (summary := _monitor_summary(item, "account")) is not None
        ]
        if isinstance(raw_account_monitors, list)
        else []
    )
    remaining_slots = 100 - len(account_monitors)
    raw_keyword_monitors = keyword_monitor_response.get("monitors", [])
    keyword_monitors = (
        [
            summary
            for item in raw_keyword_monitors[:remaining_slots]
            if (summary := _monitor_summary(item, "keyword")) is not None
        ]
        if isinstance(raw_keyword_monitors, list)
        else []
    )
    monitors = account_monitors + keyword_monitors

    raw_events = event_response.get("events", [])
    events = (
        [
            summary
            for item in raw_events
            if (summary := _event_summary(item)) is not None
        ]
        if isinstance(raw_events, list)
        else []
    )

    billing = account.get("monitorBilling", {})
    if not isinstance(billing, dict):
        billing = {}
    monitor_totals = [
        total
        for total in (
            _integer(account_monitor_response.get("total")),
            _integer(keyword_monitor_response.get("total")),
        )
        if total is not None
    ]

    return {
        "account": {
            "plan": _text(account.get("plan")),
            "xUsername": _text(account.get("xUsername")),
            "monitorsUsed": _integer(account.get("monitorsUsed")),
            "monitorBilling": {
                "activeHourlyBurn": _text(billing.get("activeHourlyBurn")),
                "activeDailyEstimate": _text(billing.get("activeDailyEstimate")),
            },
        },
        "credits": {
            "balance": _text(credits.get("balance")),
            "lifetimeUsed": _text(credits.get("lifetime_used")),
        },
        "monitors": monitors,
        "monitorTotal": sum(monitor_totals) if monitor_totals else None,
        "events": events,
        "hasMoreEvents": event_response.get("hasMore") is True,
    }
