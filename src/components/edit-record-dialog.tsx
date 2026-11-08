"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, History, PencilLine, Save } from "lucide-react";
import { type FormEvent, useEffect, useRef } from "react";
import { api } from "@/client/api-client";
import { queryKeys } from "@/client/query-keys";
import { workDateOf } from "@/domain/attendance";
import {
  type EditRecordRequest,
  editRecordRequestSchema,
  type RecordEditsResponse,
  type ShiftResponse,
} from "@/shared/api";
import {
  formatDateTime,
  formatTime,
  formatWorkDate,
  fromTokyoDateTimeLocal,
  toTokyoDateTimeLocal,
} from "@/shared/format";

type Edit = RecordEditsResponse["edits"][number];

// datetime-local has minute precision, so an untouched field would come back without the
// seconds the clock button stored; sending the original instant keeps it from counting as edited.
function toRequest(shift: ShiftResponse, form: FormData): EditRecordRequest {
  const field = (name: string) => String(form.get(name) ?? "");
  const unchangedOr = (value: string, original: string | null) =>
    original && value === toTokyoDateTimeLocal(original) ? original : fromTokyoDateTimeLocal(value);

  const clockIn = field("clockInAt");
  const clockOut = field("clockOutAt");
  if (!clockIn) throw new Error("出勤時刻を入力してください");
  const parsed = editRecordRequestSchema.safeParse({
    clockInAt: unchangedOr(clockIn, shift.clockInAt),
    clockOutAt: clockOut ? unchangedOr(clockOut, shift.clockOutAt) : null,
    reason: field("reason"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message);
  return parsed.data;
}

function timeOn(iso: string | null, workDate: string): string {
  if (!iso) return "未退勤";
  const date = workDateOf(new Date(iso));
  return date === workDate ? formatTime(iso) : `${formatWorkDate(date)} ${formatTime(iso)}`;
}

function changesOf(edit: Edit, workDate: string) {
  const changes: { label: string; from: string; to: string }[] = [];
  if (edit.previousClockInAt !== edit.newClockInAt) {
    changes.push({
      label: "出勤",
      from: timeOn(edit.previousClockInAt, workDate),
      to: timeOn(edit.newClockInAt, workDate),
    });
  }
  if (edit.previousClockOutAt !== edit.newClockOutAt) {
    changes.push({
      label: "退勤",
      from: timeOn(edit.previousClockOutAt, workDate),
      to: timeOn(edit.newClockOutAt, workDate),
    });
  }
  return changes;
}

function EditHistory({ recordId, workDate }: { recordId: string; workDate: string }) {
  const history = useQuery({
    queryKey: queryKeys.recordEdits(recordId),
    queryFn: () => api.recordEdits(recordId),
  });

  return (
    <section className="dialog-section" aria-labelledby="edit-history-heading">
      <h3 id="edit-history-heading" className="dialog-section-title">
        <History size={15} />
        修正履歴
      </h3>
      {history.isPending && <p className="muted">読み込み中…</p>}
      {history.error && (
        <p role="alert" className="alert">
          <CircleAlert size={16} />
          {history.error.message}
        </p>
      )}
      {history.data?.edits.length === 0 && <p className="muted">修正履歴はありません</p>}
      {history.data && history.data.edits.length > 0 && (
        <ol className="edit-history">
          {history.data.edits.map((edit) => (
            <li key={edit.id}>
              <div className="edit-history-meta">
                <strong>{edit.editor.displayName}</strong>
                <span className="muted num">{formatDateTime(edit.createdAt)}</span>
              </div>
              <div className="edit-history-changes num">
                {changesOf(edit, workDate).map((change) => (
                  <span key={change.label}>
                    {change.label} {change.from} → {change.to}
                  </span>
                ))}
              </div>
              <p className="edit-history-reason">{edit.reason}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function EditRecordDialog({
  shift,
  workDate,
  onClose,
}: {
  shift: ShiftResponse;
  workDate: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: (form: FormData) => api.editRecord(shift.id, toRequest(shift, form)),
    onSuccess: () => {
      dialog.current?.close();
      return queryClient.invalidateQueries({ queryKey: queryKeys.attendance });
    },
  });

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save.mutate(new FormData(event.currentTarget));
  }

  return (
    <dialog ref={dialog} className="dialog" aria-labelledby="edit-record-heading" onClose={onClose}>
      <div className="dialog-header">
        <h2 id="edit-record-heading" className="card-title">
          <PencilLine size={17} />
          勤怠の修正
        </h2>
        <span className="muted num">{formatWorkDate(workDate)}</span>
      </div>
      <form onSubmit={onSubmit} noValidate className="dialog-body stack">
        {save.error && (
          <p role="alert" className="alert">
            <CircleAlert size={16} />
            {save.error.message}
          </p>
        )}
        <div className="field-row">
          <div className="field">
            <label htmlFor="edit-clockInAt">出勤時刻</label>
            <input
              id="edit-clockInAt"
              name="clockInAt"
              type="datetime-local"
              className="input num"
              defaultValue={toTokyoDateTimeLocal(shift.clockInAt)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="edit-clockOutAt">退勤時刻</label>
            <input
              id="edit-clockOutAt"
              name="clockOutAt"
              type="datetime-local"
              className="input num"
              defaultValue={shift.clockOutAt ? toTokyoDateTimeLocal(shift.clockOutAt) : ""}
              required={shift.clockOutAt !== null}
            />
            {!shift.clockOutAt && <span className="hint">空欄のままなら勤務中のままです</span>}
          </div>
        </div>
        <div className="field">
          <label htmlFor="edit-reason">修正理由</label>
          <textarea
            id="edit-reason"
            name="reason"
            className="input textarea"
            maxLength={200}
            required
          />
        </div>
        <div className="dialog-actions">
          <button type="button" className="button ghost" onClick={() => dialog.current?.close()}>
            キャンセル
          </button>
          <button type="submit" className="button primary" disabled={save.isPending}>
            <Save size={16} />
            {save.isPending ? "保存中…" : "保存する"}
          </button>
        </div>
      </form>
      <EditHistory recordId={shift.id} workDate={workDate} />
    </dialog>
  );
}
