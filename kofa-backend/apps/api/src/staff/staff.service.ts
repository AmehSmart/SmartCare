import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Role } from '@kofa/contracts';
import { randomUUID } from 'node:crypto';
import { hashPassword } from '../auth/password.js';
import { ClinicalDatabase } from '../database.service.js';

export type StaffCreationInput = {
    email: string;
    staffId: string;
    name: string;
    pin: string;
    role: Exclude<Role, 'PATIENT' | 'CAREGIVER' | 'ADMIN' | 'AUDIT_OFFICER'>;
    department: string;
    ward?: string;
    shift: string;
};

@Injectable()
export class StaffService {
    constructor(@Inject(ClinicalDatabase) private readonly database: ClinicalDatabase) { }

    async createStaff(input: StaffCreationInput, requestedFacilityId?: string) {
        const email = input.email.trim().toLowerCase();
        const staffId = input.staffId.trim().toUpperCase();
        const departmentName = input.department.trim();
        const shiftName = input.shift.trim();

        const department = await this.database.department.findFirst({
            where: {
                ...(requestedFacilityId ? { facilityId: requestedFacilityId } : {}),
                active: true,
                name: { equals: departmentName, mode: 'insensitive' },
            },
        });
        if (!department) throw new NotFoundException('Department not found in this facility');

        const shift = await this.database.shift.findFirst({
            where: {
                facilityId: department.facilityId,
                active: true,
                name: { equals: shiftName, mode: 'insensitive' },
            },
        });
        if (!shift) throw new NotFoundException('Shift not found in this facility');

        let wardId: string | undefined;
        if (input.ward?.trim()) {
            const ward = await this.database.ward.findFirst({
                where: {
                    facilityId: department.facilityId,
                    departmentId: department.id,
                    active: true,
                    name: { equals: input.ward.trim(), mode: 'insensitive' },
                },
            });
            if (!ward) throw new NotFoundException('Ward not found in this department');
            wardId = ward.id;
        }

        const existing = await this.database.userProfile.findFirst({
            where: {
                OR: [
                    { email },
                    { authSubject: { startsWith: `staff:${staffId}:` } },
                ],
            },
            select: { id: true },
        });
        if (existing) throw new ConflictException('Staff account already exists.');

        const startsAt = new Date();
        const created = await this.database.$transaction(async (transaction) => {
            const user = await transaction.userProfile.create({
                data: {
                    authSubject: `staff:${staffId}:${randomUUID()}`,
                    displayName: input.name.trim(),
                    email,
                    passwordHash: hashPassword(input.pin),
                    facilityId: department.facilityId,
                    active: true,
                },
            });
            const assignment = await transaction.assignment.create({
                data: {
                    userId: user.id,
                    role: input.role,
                    departmentId: department.id,
                    ...(wardId ? { wardId } : {}),
                    shiftId: shift.id,
                    startsAt,
                    endsAt: new Date(startsAt.getTime() + 10 * 365 * 24 * 60 * 60 * 1000),
                    active: true,
                },
            });
            return { user, assignment };
        });

        return {
            user: created.user,
            assignment: created.assignment,
            facilityId: department.facilityId,
            department,
            shift,
        };
    }

    async registrationOptions() {
        const departments = await this.database.department.findMany({
            where: { active: true },
            select: {
                id: true,
                name: true,
                wards: {
                    where: { active: true },
                    select: { id: true, name: true },
                    orderBy: { name: 'asc' },
                },
            },
            orderBy: { name: 'asc' },
        });
        const shifts = await this.database.shift.findMany({
            where: { active: true },
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
        });
        return { departments, shifts };
    }
}
