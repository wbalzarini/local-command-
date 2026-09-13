import type { SourceRef, StatusLevel } from "@/types";
import type { RouteIncident } from "../routing/types";

export type RoadCondition = {
  /** Which route this describes: the primary, an alternate, or a named road. */
  label: string;
  level: StatusLevel;
  detail: string;
};

export type RoadClosure = {
  id: string;
  description: string;
  location?: string;
  type: "closure" | "construction" | "flooding" | "snow-ice" | "bridge-restriction" | "other";
  reportedAt?: number;
  source: SourceRef;
};

export type RoadsData = {
  conditions: RoadCondition[];
  closures: RoadClosure[];
  incidents: RouteIncident[];
  /** False when no road-condition feed is configured for this deployment. */
  configured: boolean;
  /** Named so the UI can say which agency is being quoted. */
  agency: string;
};
