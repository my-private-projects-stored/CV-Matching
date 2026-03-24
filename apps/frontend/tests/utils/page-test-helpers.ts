import { fireEvent, screen } from '@testing-library/react';
import { expect } from 'vitest';

type MockLike = {
  mock: {
    calls: unknown[][];
  };
};

export function getLatestHref(mockFn: MockLike): string {
  return String(getLatestMockCallArg<string>(mockFn) || '');
}

export function getLatestMockCallArg<T = unknown>(mockFn: MockLike, argIndex = 0): T | undefined {
  const calls = mockFn.mock.calls;
  return calls[calls.length - 1]?.[argIndex] as T | undefined;
}

export function expectLatestHrefContains(mockFn: MockLike, parts: string[]) {
  expect(mockFn.mock.calls.length).toBeGreaterThan(0);
  const latestHref = getLatestHref(mockFn);
  for (const part of parts) {
    expect(latestHref).toContain(part);
  }
}

export function expectLatestHrefQueryValues(
  mockFn: MockLike,
  expected: Record<string, string>
) {
  expect(mockFn.mock.calls.length).toBeGreaterThan(0);
  const latestHref = getLatestHref(mockFn);
  const queryPart = latestHref.split('?')[1] || '';
  const query = new URLSearchParams(queryPart);

  for (const [key, value] of Object.entries(expected)) {
    expect(query.get(key)).toBe(value);
  }
}

export function expectLatestHrefHasQueryKeys(mockFn: MockLike, keys: string[]) {
  expect(mockFn.mock.calls.length).toBeGreaterThan(0);
  const latestHref = getLatestHref(mockFn);
  const queryPart = latestHref.split('?')[1] || '';
  const query = new URLSearchParams(queryPart);

  for (const key of keys) {
    expect(query.has(key)).toBe(true);
  }
}

export function fillInputByPlaceholder(placeholder: string, value: string) {
  fireEvent.change(screen.getByPlaceholderText(placeholder), {
    target: { value },
  });
}

export function clickFirstButtonByName(name: string) {
  fireEvent.click(screen.getAllByRole('button', { name })[0]);
}
