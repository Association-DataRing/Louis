import "next-auth";
import "next-auth/jwt";
import type { UserRole } from "@/db/schema/users";

declare module "next-auth" {
  interface User {
    role: UserRole;
    tokenVersion?: number;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: UserRole;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    tokenVersion?: number;
  }
}
