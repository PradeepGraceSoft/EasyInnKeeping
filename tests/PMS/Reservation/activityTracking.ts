import { expect } from "../../../src/fixtures/sso.fixture";
import type {
  ActivityLogEntry,
  ReservationDatabaseHelper,
} from "../../../src/utils/DBHelper/ReservationDatabaseHelper";

export async function verifyReservationActivity(
  helper: ReservationDatabaseHelper,
  confirmationNumber: string,
  startedAt: Date,
  expectedActivity: RegExp,
  expectedDetails: RegExp,
  expectedStaffName: string,
): Promise<void> {
  let matchingEntry: ActivityLogEntry | undefined;
  const normalizedStaffName = expectedStaffName.trim().toLowerCase();
  await expect
    .poll(
      async () => {
        matchingEntry = (
          await helper.getReservationActivity(confirmationNumber, startedAt)
        ).find(
          (entry) =>
            expectedActivity.test(entry.activity) &&
            expectedDetails.test(entry.details ?? "") &&
            entry.staffName.trim().toLowerCase() === normalizedStaffName &&
            isWithinActivityWindow(entry.createdAt, startedAt),
        );
        return Boolean(matchingEntry);
      },
      {
        message:
          `Expected reservation ${confirmationNumber} activity ` +
          `${expectedActivity} with details ${expectedDetails}`,
        timeout: 15_000,
      },
    )
    .toBe(true);

  expect(matchingEntry?.activity.trim()).toBeTruthy();
  expect(matchingEntry?.staffName.trim().toLowerCase()).toBe(
    normalizedStaffName,
  );
  expect(matchingEntry?.details.trim()).toBeTruthy();
  expect(new Date(matchingEntry?.createdAt ?? Number.NaN).getTime()).not.toBeNaN();
}

function isWithinActivityWindow(createdAt: Date, startedAt: Date): boolean {
  const activityTime = new Date(createdAt).getTime();
  return (
    Number.isFinite(activityTime) &&
    Math.abs(activityTime - startedAt.getTime()) < 24 * 60 * 60 * 1_000
  );
}
