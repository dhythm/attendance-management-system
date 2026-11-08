"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { api } from "@/client/api-client";
import { queryKeys } from "@/client/query-keys";
import { type Role, roles } from "@/domain/role";
import { createUserRequestSchema } from "@/shared/api";
import { formatDateTime, roleLabels } from "@/shared/format";

function useInvalidateUsers() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.managedUsers }),
      queryClient.invalidateQueries({ queryKey: queryKeys.attendance }),
    ]);
}

export function UserAdmin() {
  return (
    <>
      <CreateUserCard />
      <UsersCard />
    </>
  );
}

function RoleOptions() {
  return roles.map((role) => (
    <option key={role} value={role}>
      {roleLabels[role]}
    </option>
  ));
}

function CreateUserCard() {
  const invalidate = useInvalidateUsers();
  const create = useMutation({
    mutationFn: (form: FormData) => {
      const parsed = createUserRequestSchema.safeParse(Object.fromEntries(form));
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message);
      return api.createUser(parsed.data);
    },
    onSuccess: invalidate,
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    create.mutate(new FormData(form), { onSuccess: () => form.reset() });
  }

  return (
    <section className="card" aria-labelledby="create-user-heading">
      <h2 id="create-user-heading">ユーザーを追加</h2>
      {create.error && (
        <p role="alert" className="error">
          {create.error.message}
        </p>
      )}
      {create.data && (
        <p role="status" className="success">
          {create.data.user.displayName}（{create.data.user.loginId}）を追加しました
        </p>
      )}
      <form method="post" onSubmit={onSubmit} noValidate className="form-grid">
        <div className="field">
          <label htmlFor="new-loginId">ログインID</label>
          <input id="new-loginId" name="loginId" autoComplete="off" required />
          <span className="hint">半角英数字と _ . - で3〜32文字</span>
        </div>
        <div className="field">
          <label htmlFor="new-displayName">表示名</label>
          <input id="new-displayName" name="displayName" autoComplete="off" required />
        </div>
        <div className="field">
          <label htmlFor="new-password">初期パスワード</label>
          <input
            id="new-password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
          />
          <span className="hint">8文字以上</span>
        </div>
        <div className="field">
          <label htmlFor="new-role">権限</label>
          <select id="new-role" name="role" defaultValue="employee">
            <RoleOptions />
          </select>
        </div>
        <button type="submit" className="primary" disabled={create.isPending}>
          {create.isPending ? "追加中…" : "追加する"}
        </button>
      </form>
    </section>
  );
}

function UsersCard() {
  const invalidate = useInvalidateUsers();
  const users = useQuery({ queryKey: queryKeys.managedUsers, queryFn: api.managedUsers });
  const changeRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: Role }) => api.changeRole(userId, role),
    onSettled: invalidate,
  });

  return (
    <section className="card" aria-labelledby="users-heading">
      <h2 id="users-heading" className="section-title">
        ユーザー一覧
      </h2>
      {users.error && (
        <p role="alert" className="error">
          {users.error.message}
        </p>
      )}
      {changeRole.error && (
        <p role="alert" className="error">
          {changeRole.error.message}
        </p>
      )}
      {users.isPending && <p className="muted">読み込み中…</p>}
      {users.data && (
        <table>
          <thead>
            <tr>
              <th>ログインID</th>
              <th>名前</th>
              <th>権限</th>
              <th>作成日時</th>
            </tr>
          </thead>
          <tbody>
            {users.data.users.map((user) => (
              <tr key={user.id}>
                <td>{user.loginId}</td>
                <td>{user.displayName}</td>
                <td>
                  <select
                    aria-label={`${user.displayName}の権限`}
                    value={user.role}
                    disabled={changeRole.isPending}
                    onChange={(event) =>
                      changeRole.mutate({ userId: user.id, role: event.target.value as Role })
                    }
                  >
                    <RoleOptions />
                  </select>
                </td>
                <td>{formatDateTime(user.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
