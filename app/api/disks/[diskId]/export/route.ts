import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth-options';
import { canAccessDisk, getAccessibleDiskIds } from '@/lib/disk-access';
import { buildCsv } from '@/lib/csv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ExportType = 'scans' | 'activities' | 'entries';

function csvResponse(csv: string, filename: string) {
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ diskId: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json(
      { error: 'Non autorisé. Connecte-toi puis réessaie.' },
      { status: 401 }
    );
  }

  const { diskId } = await context.params;

  const accessibleDiskIds = await getAccessibleDiskIds({
    id: session.user.id,
    role: session.user.role
  });
  if (!canAccessDisk(accessibleDiskIds, diskId)) {
    return NextResponse.json({ error: 'Disque introuvable.' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const type = (searchParams.get('type') ?? 'scans') as ExportType;

  const disk = await prisma.disk.findUnique({
    where: { id: diskId },
    select: { id: true, code: true, name: true }
  });

  if (!disk) {
    return NextResponse.json({ error: 'Disque introuvable.' }, { status: 404 });
  }

  if (type === 'scans') {
    const scanJobs = await prisma.scanJob.findMany({
      where: { diskId },
      orderBy: { createdAt: 'desc' }
    });

    const rows = scanJobs.map((job) => {
      const summary = (job.summary ?? {}) as Record<string, unknown>;

      return [
        job.createdAt.toISOString(),
        job.scanType,
        job.status,
        job.startedAt?.toISOString() ?? '',
        job.finishedAt?.toISOString() ?? '',
        summary.added ?? '',
        summary.modified ?? '',
        summary.renamed ?? '',
        summary.deleted ?? '',
        summary.totalIndexed ?? '',
        job.errorMessage ?? ''
      ];
    });

    const csv = buildCsv(
      [
        'Date',
        'Type',
        'Statut',
        'Démarré',
        'Terminé',
        'Ajoutés',
        'Modifiés',
        'Renommés',
        'Supprimés',
        'Total indexé',
        'Erreur'
      ],
      rows
    );

    return csvResponse(csv, `${disk.code}-scans.csv`);
  }

  if (type === 'activities') {
    const activities = await prisma.diskActivity.findMany({
      where: { diskId },
      orderBy: { createdAt: 'desc' }
    });

    const rows = activities.map((activity) => [
      activity.createdAt.toISOString(),
      activity.activityType,
      activity.path,
      activity.previousPath ?? '',
      activity.acknowledgedAt ? 'oui' : 'non'
    ]);

    const csv = buildCsv(
      ['Date', 'Type', 'Chemin', 'Ancien chemin', 'Acquittée'],
      rows
    );

    return csvResponse(csv, `${disk.code}-activites.csv`);
  }

  if (type === 'entries') {
    const entries = await prisma.fileEntry.findMany({
      where: { diskId, deletedAt: null },
      orderBy: { relativePath: 'asc' }
    });

    const rows = entries.map((entry) => [
      entry.entryType,
      entry.relativePath,
      entry.name,
      entry.extension ?? '',
      entry.size?.toString() ?? '',
      entry.modifiedAt?.toISOString() ?? ''
    ]);

    const csv = buildCsv(
      ['Type', 'Chemin relatif', 'Nom', 'Extension', 'Taille (octets)', 'Modifié le'],
      rows
    );

    return csvResponse(csv, `${disk.code}-fichiers.csv`);
  }

  return NextResponse.json(
    { error: "type invalide. Valeurs attendues : scans, activities, entries." },
    { status: 400 }
  );
}
