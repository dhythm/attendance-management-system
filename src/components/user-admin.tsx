"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CircleAlert, UserPlus, Users } from "lucide-react";
import type { FormEvent } from "react";
import { api } from "@/client/api-client";
import { queryKeys } from "@/client/query-keys";
import { type Role, roles } from "@/domain/role";
import { createUserRequestSchema } from "@/shared/api";
import { formatDateTime, roleLabels } from "@/shared/format";
import { Avatar } from "./identity";

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
    <div className="admin-grid">
      <CreateUserCard />
      <UsersCard />
    </div>
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
      <div className="card-header">
        <h2 id="create-user-heading" className="card-title">
          <UserPlus size={17} />
          ユーザーを追加
        </h2>
      </div>
      <form method="post" onSubmit={onSubmit} noValidate className="card-body stack">
        {create.error && (
          <p role="alert" className="alert">
            <CircleAlert size={16} />
            {create.error.message}
          </p>
        )}
        {create.data && (
          <p role="status" className="notice">
            <Check size={16} />
            {create.data.user.displayName}（{create.data.user.loginId}）を追加しました
          </p>
        )}
        <div className="field">
          <label htmlFor="new-loginId">ログインID</label>
          <input id="new-loginId" name="loginId" className="input" autoComplete="off" required />
          <span className="hint">半角英数字と _ . - で3〜32文字</span>
        </div>
        <div className="field">
          <label htmlFor="new-displayName">表示名</label>
          <input
            id="new-displayName"
            name="displayName"
            className="input"
            autoComplete="off"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="new-password">初期パスワード</label>
          <input
            id="new-password"
            name="password"
            type="password"
            className="input"
            autoComplete="new-password"
            required
          />
          <span className="hint">8文字以上</span>
        </div>
        <div className="field">
          <label htmlFor="new-role">権限</label>
          <select id="new-role" name="role" className="select" defaultValue="employee">
            <RoleOptions />
          </select>
        </div>
        <button type="submit" className="button primary block" disabled={create.isPending}>
          <UserPlus size={16} />
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
      <div className="card-header">
        <h2 id="users-heading" className="card-title">
          <Users size={17} />
          ユーザー一覧
        </h2>
        {users.data && <span className="muted num">{users.data.users.length} 人</span>}
      </div>
      {(users.error || changeRole.error) && (
        <div className="card-body">
          <p role="alert" className="alert">
            <CircleAlert size={16} />
            {(users.error ?? changeRole.error)?.message}
          </p>
        </div>
      )}
      {users.isPending && <p className="placeholder">読み込み中…</p>}
      {users.data && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>メンバー</th>
                <th>権限</th>
                <th>作成日時</th>
              </tr>
            </thead>
            <tbody>
              {users.data.users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <span className="person">
                      <Avatar name={user.displayName} seed={user.id} />
                      <span>
                        <span className="person-name">{user.displayName}</span>
                        <br />
                        <span className="person-id">{user.loginId}</span>
                      </span>
                    </span>
                  </td>
                  <td>
                    <select
                      aria-label={`${user.displayName}の権限`}
                      className={`select compact role-select ${user.role}`}
                      value={user.role}
                      disabled={changeRole.isPending}
                      onChange={(event) =>
                        changeRole.mutate({ userId: user.id, role: event.target.value as Role })
                      }
                    >
                      <RoleOptions />
                    </select>
                  </td>
                  <td className="muted num">{formatDateTime(user.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
