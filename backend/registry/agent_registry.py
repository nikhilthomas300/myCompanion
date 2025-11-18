from __future__ import annotations

from agents.general_agent import GeneralAgent
from agents.hr_policy_agent import HRPolicyAgent
from agents.leave_agent import LeaveAgent

agent_registry = {
    LeaveAgent.name: LeaveAgent(),
    HRPolicyAgent.name: HRPolicyAgent(),
    GeneralAgent.name: GeneralAgent(),
}


def agent_descriptions() -> dict[str, str]:
    return {agent_id: agent.description for agent_id, agent in agent_registry.items()}
