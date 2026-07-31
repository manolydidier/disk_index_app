// app/api/disks/[diskId]/scan/route.ts

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { DiskSourceType, ScanType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { startDiskScan } from "@/lib/scanner";
import { scanRequestSchema } from "@/lib/validators";
import { authOptions } from "@/lib/auth-options";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ diskId: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json(
      { error: "Non autorisé. Connecte-toi puis réessaie." },
      { status: 401 }
    );
  }

  const { diskId } = await context.params;

  const payload = await request.json().catch(() => ({}));
  const parsed = scanRequestSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const disk = await prisma.disk.findUnique({
      where: {
        id: diskId,
      },
      select: {
        id: true,
        code: true,
        name: true,
        sourceType: true,
      },
    });

    if (!disk) {
      return NextResponse.json(
        { error: "Disque introuvable." },
        { status: 404 }
      );
    }

    if (disk.sourceType !== DiskSourceType.SERVER) {
      return NextResponse.json(
        {
          error:
            "Ce disque n'est pas géré par le serveur. Utilisez le scan agent.",
        },
        { status: 400 }
      );
    }

    const job = await startDiskScan(
      diskId,
      parsed.data.scanType === "FULL"
        ? ScanType.FULL
        : ScanType.DIFFERENTIAL
    );

    return NextResponse.json(
      {
        id: job.id,
        jobId: job.id,
        diskId: job.diskId,
        status: job.status,
        progressPercent: job.progressPercent ?? 0,
      },
      { status: 202 }
    );
  } catch (error) {
    console.error("SCAN START ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Impossible de démarrer le scan.",
      },
      { status: 500 }
    );
  }
}