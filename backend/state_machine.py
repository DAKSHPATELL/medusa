"""Workflow state transitions for ClearBorder V2."""

from __future__ import annotations

from database import EnvironmentState, WorkflowState

ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    WorkflowState.PENDING_UPLOAD.value: {WorkflowState.EXTRACTED.value},
    WorkflowState.EXTRACTED.value: {WorkflowState.PORTAL_SYNCING.value},
    WorkflowState.PORTAL_SYNCING.value: {
        WorkflowState.AWAITING_APPROVAL.value,
        WorkflowState.EXCEPTION_HOLD.value,
    },
    WorkflowState.AWAITING_APPROVAL.value: {
        WorkflowState.COMPLETED.value,
        WorkflowState.EXCEPTION_HOLD.value,
    },
    WorkflowState.COMPLETED.value: set(),
    WorkflowState.EXCEPTION_HOLD.value: set(),
}


def can_transition(current: str, target: str) -> bool:
    return target in ALLOWED_TRANSITIONS.get(current, set())


def transition(env: EnvironmentState, target: WorkflowState, log: str | None = None) -> None:
    if not can_transition(env.state, target.value):
        raise ValueError(f"invalid transition {env.state} → {target.value}")
    env.state = target.value
    if log:
        env.append_log(log)
