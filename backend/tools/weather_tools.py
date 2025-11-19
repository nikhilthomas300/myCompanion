from __future__ import annotations

import json
import re
from datetime import datetime
from typing import Any

from core.gemini_client import GeminiClient

_weather_client = GeminiClient()
_JSON_PATTERN = re.compile(r"\{.*\}", re.DOTALL)


def _extract_json_block(raw_text: str) -> dict[str, Any]:
    try:
        return json.loads(raw_text)
    except json.JSONDecodeError:
        match = _JSON_PATTERN.search(raw_text)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                return {}
    return {}


def _format_percentage(value: Any) -> str | None:
    if value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return f"{round(number)}%"


def _format_temperature_entry(value: Any, unit: str | None) -> str | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    unit_str = unit or "°C"
    return f"{number:.0f}{unit_str}"


def _as_list(value: Any) -> list[Any]:
    if isinstance(value, list):
        return value
    if value is None:
        return []
    return [value]


def _normalize_payload(raw: dict[str, Any], fallback_location: str) -> dict[str, Any]:
    temperature = raw.get("temperature") or {}
    temp_unit = temperature.get("unit") or raw.get("temperatureUnit") or "°C"
    feels_like = temperature.get("feelsLike") or raw.get("feelsLike")
    feels_like_text = (
        _format_temperature_entry(feels_like, temp_unit)
        if feels_like is not None
        else None
    )

    stats: list[dict[str, str]] = []

    def add_stat(label: str, value: str | None) -> None:
        if value:
            stats.append({"label": label, "value": value})

    add_stat("Feels like", feels_like_text)
    add_stat("Humidity", _format_percentage(raw.get("humidity")))
    rain = raw.get("precipitationChance") or raw.get("precipChance")
    add_stat("Chance of rain", _format_percentage(rain))
    wind = raw.get("wind") or {}
    wind_speed = wind.get("speedKph") or wind.get("speedMph") or wind.get("speed")
    wind_unit = "kph" if wind.get("speedKph") else ("mph" if wind.get("speedMph") else "km/h")
    wind_direction = wind.get("direction") or wind.get("bearing")
    wind_text = None
    if wind_speed is not None:
        try:
            speed_val = float(wind_speed)
            wind_text = f"{speed_val:.0f} {wind_unit}"
            if wind_direction:
                wind_text = f"{wind_text} {wind_direction}"
        except (TypeError, ValueError):
            wind_text = None
    add_stat("Wind", wind_text)
    uv_value = raw.get("uvIndex") or raw.get("uv")
    add_stat("UV index", str(uv_value) if uv_value is not None else None)

    forecast_entries: list[dict[str, str]] = []
    for entry in _as_list(raw.get("forecast"))[:4]:
        if not isinstance(entry, dict):
            continue
        label = entry.get("label") or entry.get("period") or entry.get("day")
        temp = entry.get("temp") or entry.get("temperature")
        entry_unit = entry.get("unit") or temp_unit
        forecast_entries.append(
            {
                "label": label or "",
                "temp": _format_temperature_entry(temp, entry_unit) or "",
                "condition": entry.get("condition") or entry.get("summary") or "",
                "precipitationChance": _format_percentage(
                    entry.get("precipitationChance") or entry.get("precipChance")
                )
                or "",
            }
        )

    tips = [tip for tip in _as_list(raw.get("tips") or raw.get("recommendations")) if isinstance(tip, str)]
    if not tips and raw.get("summary"):
        tips.append("Pack accordingly and monitor for updates.")

    headline = raw.get("headline") or raw.get("summary")
    summary = raw.get("summary") or raw.get("condition") or "Weather details"

    return {
        "location": raw.get("location") or fallback_location,
        "asOf": raw.get("asOf") or raw.get("timestamp") or datetime.utcnow().strftime("%d %b %Y %H:%M UTC"),
        "summary": summary,
        "condition": raw.get("condition") or raw.get("summary") or "",
        "headline": headline,
        "temperature": {
            "value": temperature.get("value") or raw.get("temperature"),
            "unit": temp_unit,
        },
        "stats": [stat for stat in stats if stat.get("value")],
        "forecast": forecast_entries,
        "tips": tips,
    }


def _fallback_payload(location: str) -> dict[str, Any]:
    return {
        "location": location or "Your location",
        "asOf": datetime.utcnow().strftime("%d %b %Y %H:%M UTC"),
        "summary": "Expect mild temperatures with a slight chance of afternoon showers.",
        "condition": "Partly cloudy",
        "headline": "Carry a light layer and stay hydrated.",
        "temperature": {"value": 24, "unit": "°C"},
        "stats": [
            {"label": "Feels like", "value": "25°C"},
            {"label": "Humidity", "value": "58%"},
            {"label": "Chance of rain", "value": "30%"},
            {"label": "Wind", "value": "11 km/h SW"},
            {"label": "UV index", "value": "7"},
        ],
        "forecast": [
            {"label": "Morning", "temp": "22°C", "condition": "Humid", "precipitationChance": "15%"},
            {"label": "Afternoon", "temp": "27°C", "condition": "Spot showers", "precipitationChance": "40%"},
            {"label": "Evening", "temp": "23°C", "condition": "Cloudy", "precipitationChance": "20%"},
        ],
        "tips": [
            "Keep a compact umbrella handy.",
            "Plan commutes with possible light showers in mind.",
        ],
    }


async def weather_card_tool(payload: dict[str, Any]) -> dict[str, Any]:
    location = (payload.get("location") or payload.get("city") or payload.get("question") or "Your location").strip()
    question = payload.get("question") or "Give me the latest weather." 
    prompt = (
        "You are a concise enterprise weather assistant. "
        "Summarize expected conditions for the next few hours based on trustworthy forecasts. "
        "Always respond with valid JSON only (no markdown) using this shape:\n"
        "{\n"
        "  \"location\": string,\n"
        "  \"asOf\": string (e.g. '19 Nov 2025 09:00 IST'),\n"
        "  \"summary\": string,\n"
        "  \"condition\": string,\n"
        "  \"headline\": string,\n"
        "  \"temperature\": {\"value\": number, \"unit\": string, \"feelsLike\": number},\n"
        "  \"humidity\": number,\n"
        "  \"precipitationChance\": number,\n"
        "  \"uvIndex\": number,\n"
        "  \"wind\": {\"speedKph\": number, \"direction\": string},\n"
        "  \"forecast\": [\n"
        "    {\"label\": string, \"temp\": number, \"unit\": string, \"condition\": string, \"precipitationChance\": number}\n"
        "  ],\n"
        "  \"tips\": [string]\n"
        "}\n"
        "Use best-effort estimates if live data is unavailable and clearly state approximations.\n"
        f"Location/context: {location}.\n"
        f"User request: {question}"
    )

    raw_response = await _weather_client.generate_text(prompt)
    parsed = _extract_json_block(raw_response)
    props = _normalize_payload(parsed, location) if parsed else _fallback_payload(location)

    summary_text = props.get("summary") or "Here is the latest weather snapshot."

    return {
        "component_id": "weather.showCard",
        "props": props,
        "summary": summary_text,
        "message": summary_text,
        "requires_human": False,
        "artifacts": [],
    }


def weather_card_schema() -> dict[str, Any]:
    return {
        "name": "weather.showCard",
        "description": "Render a compact weather overview (current conditions + mini forecast).",
        "parameters": {
            "type": "object",
            "properties": {
                "location": {"type": "string", "description": "City or campus to summarize"},
                "question": {"type": "string", "description": "Original employee request"},
            },
            "required": ["question"],
        },
    }
