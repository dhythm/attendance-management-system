export type UserId = string & { readonly __brand: "UserId" };

export type User = { id: UserId; loginId: string; displayName: string };
