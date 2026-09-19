// Notifications feature.
//
// This surface exists in the Kofa backend (GET /v1/notifications,
// PATCH /v1/notifications/:id/read) but had no frontend before. When the
// backend is configured it reads live notifications; otherwise it returns a
// small mock set so the screen is still demonstrable in prototype mode.

import { isBackendEnabled } from "./config";
import {
  getNotifications as backendGetNotifications,
  markNotificationRead as backendMarkNotificationRead,
} from "./backendAdapter";

const MOCK_NOTIFICATIONS = [
  {
    id: "mock-1",
    type: "BREAK_GLASS_ACCESS",
    title: "Emergency access used on your record",
    metadata: { actor: "Dr. Adaeze Okonkwo", reasonCode: "UNCONSCIOUS_PATIENT" },
    createdAt: "2026-09-19T08:12:00Z",
    readAt: null,
    read: false,
  },
  {
    id: "mock-2",
    type: "SENSITIVE_FIELD_REVEAL",
    title: "A sensitive field on your chart was revealed",
    metadata: { actor: "Nurse Emeka Nwosu", field: "HIV Status" },
    createdAt: "2026-09-18T16:40:00Z",
    readAt: "2026-09-18T17:00:00Z",
    read: true,
  },
];

export async function getNotifications() {
  if (isBackendEnabled()) {
    return backendGetNotifications();
  }
  await new Promise((resolve) => setTimeout(resolve, 200));
  return MOCK_NOTIFICATIONS.map((item) => ({ ...item }));
}

export async function markNotificationRead(id) {
  if (isBackendEnabled()) {
    return backendMarkNotificationRead(id);
  }
  await new Promise((resolve) => setTimeout(resolve, 120));
  const target = MOCK_NOTIFICATIONS.find((item) => item.id === id);
  if (target) {
    target.read = true;
    target.readAt = new Date().toISOString();
  }
  return { read: true };
}
