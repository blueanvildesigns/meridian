// Copy as text (M8; canvas CopyTextOutput): the moment on screen as plain text for a message.
// One line per card, in list order, each with its own date (decision 2, Option A), then a blank
// line and a Meridian link to the same moment (decisions 3 and 7).
//
//   New York City: Tue, Mar 30, 9:00 AM EDT
//   My Local Time (America/Chicago): Tue, Mar 30, 8:00 AM CDT
//
//   https://meridian.blueanvildesigns.io/#at=2027-03-30T13:00:00Z&ref=America/Chicago
//
// The lines are built from the cards' own views, so the text says exactly what the cards show:
// the names as shown, renames included (decision 4), and the app's 12/24-hour setting and English
// day and month names (M8-4). The link follows M5-1 and never carries a rename.

import type { CardView, ClockView } from '../clock/cardView';
import type { JumpState } from '../../time/jumpUrl';
import { T } from '../../time/temporal';

/** "New York City: Tue, Mar 30, 9:00 AM EDT", or the UTC offset when there's no abbreviation. */
export function copyTextLine(view: ClockView): string {
  // My Local Time names its zone, as drawn: a zone, not a place (decision 5).
  const name = view.local ? `${view.name} (${view.zone})` : view.name;
  const time = view.dayPeriod ? `${view.time} ${view.dayPeriod}` : view.time;
  return `${name}: ${view.date}, ${time} ${view.abbreviation ?? view.offset}`;
}

/**
 * The whole text: a line per card whose zone this browser knows (the others show no time), then
 * a blank line and the link.
 */
export function copyText(views: readonly CardView[], link: string): string {
  const lines = views.filter((v): v is ClockView => v.status === 'ok').map((v) => copyTextLine(v));
  return [...lines, '', link].join('\n');
}

/**
 * What live mode's text links to: the minute on screen, as a Jump measured from the device's zone,
 * with no name (decision 7, M5-1). The person who opens it sees a fixed time, not a live clock.
 */
export function liveMoment(nowMs: number, deviceZone: string): JumpState {
  const minute = Math.floor(nowMs / 60_000) * 60_000;
  return { instant: T().Instant.fromEpochMilliseconds(minute), refZone: deviceZone };
}
