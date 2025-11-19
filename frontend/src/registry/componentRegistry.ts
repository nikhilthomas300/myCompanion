import type { ComponentType } from "react";
import LeaveApplyForm from "@/tools/LeaveApplyForm";
import PolicyCard from "@/tools/PolicyCard";
import WeatherCard from "@/tools/WeatherCard";

export type ToolComponentProps = {
  props: Record<string, unknown>;
};

const registry: Record<string, ComponentType<ToolComponentProps>> = {
  "leave.applyForm": LeaveApplyForm,
  "policy.showCard": PolicyCard,
  "weather.showCard": WeatherCard,
};

export function resolveComponent(toolId: string) {
  return registry[toolId];
}
