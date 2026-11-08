"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/client/api-client";
import { type Capability, can, type Role } from "@/domain/role";

const navigation: readonly { href: string; label: string; capability: Capability }[] = [
  { href: "/", label: "打刻", capability: "clock" },
  { href: "/manager", label: "勤怠一覧", capability: "viewAllAttendance" },
  { href: "/admin/users", label: "ユーザー管理", capability: "manageUsers" },
];

export function AppHeader({ user }: { user: { displayName: string; role: Role } }) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const logout = useMutation({
    mutationFn: api.logout,
    onSuccess: () => {
      queryClient.clear();
      router.replace("/login");
      router.refresh();
    },
  });
  const links = navigation.filter((item) => can(user.role, item.capability));

  return (
    <>
      <div className="header">
        <h1>勤怠管理</h1>
        <div>
          <span className="muted">{user.displayName} さん</span>{" "}
          <button type="button" onClick={() => logout.mutate()} disabled={logout.isPending}>
            ログアウト
          </button>
        </div>
      </div>
      {links.length > 1 && (
        <nav className="nav" aria-label="メニュー">
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname === item.href ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
      {logout.error && (
        <p role="alert" className="error">
          {logout.error.message}
        </p>
      )}
    </>
  );
}
