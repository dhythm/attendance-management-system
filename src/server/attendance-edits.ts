import { decideEdit, type EditError } from "@/domain/attendance";
import { err, ok, type Result } from "@/domain/result";
import { canEditAttendance } from "@/domain/role";
import type { User, UserId } from "@/domain/user";
import type { Db } from "@/server/db/client";
import {
  type AttendanceRecordEdit,
  type AttendanceRecordId,
  findRecordOwner,
  type ListedAttendanceRecord,
  listOtherRecordsOverlapping,
  listRecordEdits,
  lockRecord,
  lockUserAttendance,
  saveRecordEdit,
} from "@/server/repositories/attendance";

// Someone else's record and a missing one look the same, so record IDs cannot be probed.
async function findEditableOwner(
  db: Db,
  viewer: User,
  recordId: AttendanceRecordId,
): Promise<UserId | null> {
  const owner = await findRecordOwner(db, recordId);
  return owner && canEditAttendance(viewer.role, owner === viewer.id) ? owner : null;
}

export async function editAttendanceRecord(
  db: Db,
  edit: {
    recordId: AttendanceRecordId;
    editor: User;
    clockInAt: Date;
    clockOutAt: Date | null;
    reason: string;
    now: Date;
  },
): Promise<Result<ListedAttendanceRecord, EditError | "RECORD_NOT_FOUND">> {
  return db.transaction(async (tx) => {
    const owner = await findEditableOwner(tx, edit.editor, edit.recordId);
    if (!owner) return err("RECORD_NOT_FOUND");
    // Edits to different records of one user would each pass the overlap check on their own;
    // locking the owner first makes them take turns and see each other's result.
    await lockUserAttendance(tx, owner);
    const record = await lockRecord(tx, edit.recordId);
    if (!record) return err("RECORD_NOT_FOUND");

    const input = { clockInAt: edit.clockInAt, clockOutAt: edit.clockOutAt };
    const others = await listOtherRecordsOverlapping(tx, owner, record.id, {
      start: input.clockInAt,
      end: input.clockOutAt ?? edit.now,
    });
    const decision = decideEdit(record, others, input, edit.now);
    if (!decision.ok) return decision;

    return ok(
      await saveRecordEdit(tx, {
        record,
        next: decision.value,
        editorId: edit.editor.id,
        reason: edit.reason,
        at: edit.now,
      }),
    );
  });
}

export async function loadRecordEdits(
  db: Db,
  viewer: User,
  recordId: AttendanceRecordId,
): Promise<Result<AttendanceRecordEdit[], "RECORD_NOT_FOUND">> {
  if (!(await findEditableOwner(db, viewer, recordId))) return err("RECORD_NOT_FOUND");
  return ok(await listRecordEdits(db, recordId));
}
