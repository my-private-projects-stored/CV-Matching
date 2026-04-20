import test from "node:test";
import assert from "node:assert/strict";

import { parseCsvTable } from "./csv-table.mjs";

test("parseCsvTable returns empty rows for empty input", () => {
  assert.deepEqual(parseCsvTable(""), []);
});

test("parseCsvTable parses basic csv rows", () => {
  const csvText = "a,b,c\n1,2,3\n4,5,6";
  assert.deepEqual(parseCsvTable(csvText), [
    ["a", "b", "c"],
    ["1", "2", "3"],
    ["4", "5", "6"],
  ]);
});

test("parseCsvTable handles quoted commas and escaped quotes", () => {
  const csvText = 'id,name,note\n1,"Candidate, A","said ""hello"""';
  assert.deepEqual(parseCsvTable(csvText), [
    ["id", "name", "note"],
    ["1", "Candidate, A", 'said "hello"'],
  ]);
});

test("parseCsvTable preserves embedded newline inside quoted cell", () => {
  const csvText = 'id,description\n1,"line 1\nline 2"\n2,"single line"';
  assert.deepEqual(parseCsvTable(csvText), [
    ["id", "description"],
    ["1", "line 1\nline 2"],
    ["2", "single line"],
  ]);
});

test("parseCsvTable handles CRLF and trailing newline without empty row", () => {
  const csvText = "id,value\r\n1,alpha\r\n2,beta\r\n";
  assert.deepEqual(parseCsvTable(csvText), [
    ["id", "value"],
    ["1", "alpha"],
    ["2", "beta"],
  ]);
});

test("parseCsvTable preserves empty columns and trailing empty cells", () => {
  const csvText = "id,name,note\n1,,alpha\n2,\"\",beta\n3,gamma,";
  assert.deepEqual(parseCsvTable(csvText), [
    ["id", "name", "note"],
    ["1", "", "alpha"],
    ["2", "", "beta"],
    ["3", "gamma", ""],
  ]);
});

test("parseCsvTable keeps best-effort parsing for unmatched quote input", () => {
  const csvText = 'id,note\n1,"unclosed note';
  assert.deepEqual(parseCsvTable(csvText), [
    ["id", "note"],
    ["1", "unclosed note"],
  ]);
});