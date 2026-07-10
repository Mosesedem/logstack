/** Post-login destination based on platform role. */
export function postLoginPath(role?: string | null): string {
  return role === "admin" ? "/admin" : "/overview";
}

export function isPlatformAdmin(role?: string | null): boolean {
  return role === "admin";
}
