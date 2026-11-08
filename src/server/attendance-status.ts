import { type AttendanceStatus, deriveStatus } from "@/domain/attendance";
import type { UserId } from "@/domain/user";
import type { Db } from "@/server/db/client";
import { findOpenRecord } from "@/server/repositories/attendance";
import type { StatusResponse } from "@/shared/api";

export async function loadStatus(db: Db, userId: UserId): Promise<AttendanceStatus> {
  return deriveStatus(await findOpenRecord(db, userId));
}

export function toStatusResponse(status: AttendanceStatus): StatusResponse {
  return status.kind === "working"
    ? { status: { kind: "working", since: status.since.toISOString() } }
    : { status: { kind: "off_duty" } };
}
