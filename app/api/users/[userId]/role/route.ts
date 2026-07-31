// app/api/users/[userId]/role/route.ts

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth-options";

const updateRoleSchema = z.object({
  role: z.enum(["ADMIN", "USER"]),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json(
      { error: "Non autorisé." },
      { status: 401 }
    );
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Accès réservé aux administrateurs." },
      { status: 403 }
    );
  }

  const { userId } = await context.params;

  const body = await request.json().catch(() => ({}));
  const parsed = updateRoleSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Rôle invalide." },
      { status: 400 }
    );
  }

  const existingUser = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      role: true,
    },
  });

  if (!existingUser) {
    return NextResponse.json(
      { error: "Utilisateur introuvable." },
      { status: 404 }
    );
  }

  const updatedUser = await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      role: parsed.data.role,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    user: updatedUser,
  });
}