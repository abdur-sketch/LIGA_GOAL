import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { db } from "@/lib/db";
import { loginSchema } from "@/lib/validation/auth";
import { clearRateLimit, enforceMutationRateLimit, rateLimitKey } from "@/lib/security/rate-limit";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  pages: { signIn: "/login", error: "/login" },
  cookies: {
    sessionToken: {
      name: `${process.env.NODE_ENV === "production" ? "__Secure-" : ""}liga-goal.session-token`,
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" },
    },
  },
  providers: [
    CredentialsProvider({
      name: "Email dan kata sandi",
      credentials: { email: { label: "Email", type: "email" }, password: { label: "Kata sandi", type: "password" } },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const loginBucket = rateLimitKey(["login", parsed.data.email]);
        await enforceMutationRateLimit(loginBucket, 8, 15 * 60_000);
        const user = await db.user.findUnique({ where: { email: parsed.data.email } });
        if (!user?.isActive || user.deletedAt || !(await compare(parsed.data.password, user.passwordHash))) return null;
        await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
        await clearRateLimit(loginBucket);
        await db.auditLog.create({ data: { actorId: user.id, action: "LOGIN", resourceType: "SESSION", resourceId: user.id } });
        return { id: user.id, email: user.email, name: user.name, image: user.image, sessionVersion: user.sessionVersion };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.sessionVersion = (user as typeof user & { sessionVersion: number }).sessionVersion;
        token.revoked = false;
        return token;
      }
      if (!token.userId) return token;
      const current = await db.user.findUnique({
        where: { id: token.userId },
        select: { isActive: true, deletedAt: true, sessionVersion: true },
      });
      token.revoked = !current?.isActive || Boolean(current.deletedAt) || current.sessionVersion !== token.sessionVersion;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.userId && !token.revoked) session.user.id = token.userId;
      else if (session.user) session.user.id = "";
      return session;
    },
  },
};
