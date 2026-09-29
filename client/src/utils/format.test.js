import test from "node:test";
import assert from "node:assert/strict";
import {
  formatDate,
  formatTime,
  toLocalDateInputValue,
  toLocalTimeInputValue,
} from "./format.js";

test("local input helpers produce HTML date and time values", () => {
  const value = new Date(2026, 0, 2, 9, 5);

  assert.equal(toLocalDateInputValue(value), "2026-01-02");
  assert.equal(toLocalTimeInputValue(value), "09:05");
});

test("display formatters use the en-IN locale and handle missing values", () => {
  const value = new Date(2026, 0, 2, 9, 5);

  assert.match(formatDate(value), /2026/);
  assert.match(formatTime(value), /9:05/);
  assert.equal(formatDate(null), "-");
  assert.equal(formatTime("not-a-date", "Unavailable"), "Unavailable");
});
