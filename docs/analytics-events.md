# BiPolaris Analytics Events

This document defines the first-party event tracking used by BiPolaris.
Events are stored by the FastAPI backend in `event_logs`; no third-party
analytics provider is required for MVP.

## Privacy Rules

- Do not store full chat text in analytics events.
- Do not store emergency contact phone numbers.
- Do not store free-text notes.
- Prefer structured fields such as `risk_level`, `bd_state`, lengths, booleans,
  and categories.
- Deleting user data deletes mood logs, settings, and event logs for that user.

## Core Funnel

- `app_opened`
- `privacy_notice_confirmed`
- `checkin_completed`
- `chat_started`

Useful metrics:

- First chat conversion = `chat_started / app_opened`
- Check-in completion = `checkin_completed / app_opened`

## Chat And Model Quality

- `message_sent`
- `assistant_reply_received`
- `chat_error`
- `feedback_submitted`
- `risk_detected`
- `crisis_override_triggered`
- `hotline_clicked`

Useful properties:

- `message_length`
- `risk_level`
- `bd_state`
- `selected_strategy`
- `used_openai`
- `used_rag`
- `rag_top_source`
- `rag_top_score`
- `response_time_ms`
- `reply_length`

Useful metrics:

- AI calls per active user
- P50/P95 response time
- RAG hit rate
- Crisis override rate
- Hotline click-through rate
- Feedback rate and negative feedback rate

## Mood Tracking

- `mood_log_created`
- `report_tab_viewed`

Useful properties:

- `mood`
- `sleep`
- `energy`
- `impulse`
- `medication`
- `state`
- `has_notes`

Useful metrics:

- D1/D7 mood logging retention
- 7-day continuous logging rate
- State distribution

## Settings And Privacy

- `profile_saved`
- `user_settings_saved`
- `setting_toggled`
- `emergency_contact_added`
- `emergency_contact_removed`
- `long_term_memory_enabled`
- `long_term_memory_disabled`
- `privacy_policy_viewed`
- `data_exported`
- `data_delete_requested`

Useful metrics:

- Emergency contact setup rate
- Long-term memory opt-in rate
- Data export rate
- Data deletion rate

## Event Shape

Frontend events are sent to `POST /events`:

```json
{
  "id": "uuid",
  "user_id": "anon_xxx",
  "session_id": "sess_xxx",
  "event_name": "assistant_reply_received",
  "event_time": "2026-06-26T10:30:00.000Z",
  "app_version": "0.1.0",
  "platform": "web",
  "properties": {
    "risk_level": "low",
    "bd_state": "depressed",
    "used_rag": true,
    "response_time_ms": 1800
  }
}
```

## Product Owner Metrics Endpoint

MVP metrics can be viewed from the backend endpoint:

```text
GET /admin/metrics?days=7
```

Production URL:

```text
https://bipolaris-api.onrender.com/admin/metrics?days=7
```

If `ADMIN_METRICS_TOKEN` is configured in Render, add it as a query parameter:

```text
https://bipolaris-api.onrender.com/admin/metrics?days=7&token=YOUR_TOKEN
```

The response includes:

- Funnel: open, privacy confirmation, check-in completion, chat start
- Engagement: messages, replies, feedback, chat errors
- Safety: risk detection, crisis override, hotline clicks
- Model quality: RAG hit rate, OpenAI usage rate, average response time
- Settings/privacy: emergency contact, long-term memory, data export/delete
