import { callAction } from "./api";
import type { TemperatureEvent, Task, Review } from "../types";

export async function fetchMemberProfile(
  userId: string,
  organizationId: string,
) {
  return callAction<
    { userId: string; organizationId: string },
    {
      events: TemperatureEvent[];
      tasks: Task[];
      reviews: Review[];
      evidence: Array<Record<string, any>>;
      currentTemperature: number;
    }
  >("getMemberProfile", { userId, organizationId });
}
