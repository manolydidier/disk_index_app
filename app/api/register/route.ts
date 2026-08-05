// app/api/register/route.ts

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth-options";

const registerSchema = z.object({
  name: z.string().min(2).max(80).optional().or(z.literal("")),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  try {
    const userCount = await prisma.user.count();

    // Self-registration only bootstraps the very first account. Once at
    // least one account exists, only an admin can create new ones —
    // otherwise anyone reaching this endpoint could grant themself access
    // to every indexed disk.
    if (userCount > 0) {
      const session = await getServerSession(authOptions);

      if (session?.user?.role !== "ADMIN") {
        return NextResponse.json(
          {
            error:
              "Seul un administrateur peut créer un nouveau compte. Contacte ton administrateur.",
          },
          { status: 403 }
        );
      }
    }

    const body = await request.json();

    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides." },
        { status: 400 }
      );
    }

    const { name, email, password } = parsed.data;

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Un compte existe déjà avec cet email." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name: name || null,
        email: normalizedEmail,
        passwordHash,
        role: userCount === 0 ? "ADMIN" : "USER",
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    return NextResponse.json(
      {
        message: "Compte créé avec succès.",
        user,
        invitedByAdmin: userCount > 0,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[REGISTER_ERROR]", error);

    return NextResponse.json(
      { error: "Erreur serveur." },
      { status: 500 }
    );
  }
}