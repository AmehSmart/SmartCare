import { readFile, readdir, stat } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import { PrismaClient, type Prisma } from '../../generated/clinical/client.js';
import { z } from 'zod';

const database = new PrismaClient();
const ResourceSchema = z
  .object({ resourceType: z.string().min(1), id: z.string().min(1) })
  .passthrough();
const BundleSchema = z.object({
  resourceType: z.literal('Bundle'),
  entry: z.array(z.object({ resource: ResourceSchema })).default([]),
});
const OverlaySchema = z.object({
  patients: z
    .record(
      z.string(),
      z.object({
        displayName: z.string(),
        birthDate: z.string().date().optional(),
        currentWardId: z.uuid().optional(),
      }),
    )
    .default({}),
  resources: z.array(ResourceSchema).default([]),
});

async function main(): Promise<void> {
  const input = argument('--input');
  const facilityId = argument('--facility');
  const overlayPath = optionalArgument('--overlay');
  const defaultWardId = optionalArgument('--ward');
  const resources = await loadResources(resolve(input));
  const overlay = overlayPath
    ? OverlaySchema.parse(JSON.parse(await readFile(resolve(overlayPath), 'utf8')))
    : { patients: {}, resources: [] };
  resources.push(...overlay.resources);
  const patients = resources.filter((resource) => resource.resourceType === 'Patient');
  for (const resource of patients) {
    const localized = overlay.patients[resource.id];
    const displayName =
      localized?.displayName ?? patientDisplay(resource) ?? `Synthetic patient ${resource.id}`;
    await database.patient.upsert({
      where: { fhirId: resource.id },
      create: {
        fhirId: resource.id,
        facilityId,
        currentWardId: localized?.currentWardId ?? defaultWardId,
        displayName,
        birthDate: localized?.birthDate ? new Date(localized.birthDate) : readBirthDate(resource),
      },
      update: {
        displayName,
        currentWardId: localized?.currentWardId ?? defaultWardId,
        birthDate: localized?.birthDate ? new Date(localized.birthDate) : readBirthDate(resource),
      },
    });
  }
  let imported = 0;
  for (const resource of resources) {
    const patientFhirId = patientReference(resource);
    if (!patientFhirId) continue;
    const patient = await database.patient.findUnique({ where: { fhirId: patientFhirId } });
    if (!patient) continue;
    await database.fhirResource.upsert({
      where: {
        resourceType_fhirId_version: {
          resourceType: resource.resourceType,
          fhirId: resource.id,
          version: 1,
        },
      },
      create: {
        patientId: patient.id,
        resourceType: resource.resourceType,
        fhirId: resource.id,
        version: 1,
        resource: resource as Prisma.InputJsonValue,
        sourceLabel: 'HOSPITAL_VERIFIED',
      },
      update: { resource: resource as Prisma.InputJsonValue },
    });
    imported += 1;
  }
  process.stdout.write(
    `Imported ${imported} FHIR resources from ${basename(input)} with ${Object.keys(overlay.patients).length} localized patients.\n`,
  );
}

async function loadResources(path: string): Promise<Array<z.infer<typeof ResourceSchema>>> {
  const input = await stat(path);
  const names = input.isDirectory()
    ? (await readdir(path)).filter((name) => ['.json', '.ndjson'].includes(extname(name)))
    : [basename(path)];
  const root = input.isDirectory() ? path : resolve(path, '..');
  const output: Array<z.infer<typeof ResourceSchema>> = [];
  for (const name of names) {
    const text = await readFile(resolve(root, name), 'utf8');
    const values =
      extname(name) === '.ndjson'
        ? text
            .split(/\r?\n/)
            .filter(Boolean)
            .map((line) => JSON.parse(line) as unknown)
        : [JSON.parse(text) as unknown];
    for (const value of values) {
      const bundle = BundleSchema.safeParse(value);
      if (bundle.success) output.push(...bundle.data.entry.map((entry) => entry.resource));
      else output.push(ResourceSchema.parse(value));
    }
  }
  return output;
}

function patientReference(resource: Record<string, unknown>): string | undefined {
  if (resource.resourceType === 'Patient') return String(resource.id);
  for (const field of ['subject', 'patient', 'beneficiary']) {
    const reference = (resource[field] as Record<string, unknown> | undefined)?.reference;
    if (typeof reference === 'string' && reference.startsWith('Patient/'))
      return reference.slice(8);
  }
  return undefined;
}

function patientDisplay(resource: Record<string, unknown>): string | undefined {
  const name = Array.isArray(resource.name)
    ? (resource.name[0] as Record<string, unknown> | undefined)
    : undefined;
  const given = Array.isArray(name?.given) ? name.given.join(' ') : '';
  const family = typeof name?.family === 'string' ? name.family : '';
  return `${given} ${family}`.trim() || undefined;
}

function readBirthDate(resource: Record<string, unknown>): Date | undefined {
  return typeof resource.birthDate === 'string' ? new Date(resource.birthDate) : undefined;
}

function argument(name: string): string {
  const value = optionalArgument(name);
  if (!value) throw new Error(`Missing required ${name} argument`);
  return value;
}

function optionalArgument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

main()
  .catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? (error.stack ?? error.message) : JSON.stringify(error)}\n`,
    );
    process.exitCode = 1;
  })
  .finally(async () => database.$disconnect());
