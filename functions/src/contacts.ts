// Where a reporter's optional contact email goes: never the public issue, but a private Firestore
// document, `bugReportContacts/{issueNumber}`. Security rules (firestore.rules) deny every client
// read and write; only this function's service account (through the Admin SDK) and project owners
// in the Firebase console can see it. Each document carries `expireAt` (180 days on) for a
// Firestore TTL policy to delete it (owner step in docs/manual-setup-bug-reporting.md).

import type { Firestore } from 'firebase-admin/firestore';

export const CONTACTS_COLLECTION = 'bugReportContacts';
export const CONTACT_RETENTION_DAYS = 180;

export interface ContactRecord {
  email: string;
  issueNumber: number;
  issueUrl: string;
  createdAt: Date;
  expireAt: Date;
}

export function contactRecord(
  email: string,
  issue: { number: number; url: string },
  now: Date,
): ContactRecord {
  return {
    email,
    issueNumber: issue.number,
    issueUrl: issue.url,
    createdAt: now,
    expireAt: new Date(now.getTime() + CONTACT_RETENTION_DAYS * 24 * 60 * 60 * 1000),
  };
}

export async function saveContact(db: Firestore, record: ContactRecord): Promise<void> {
  await db.collection(CONTACTS_COLLECTION).doc(String(record.issueNumber)).set(record);
}
