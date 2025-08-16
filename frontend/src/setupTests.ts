// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock window.URL.createObjectURL
Object.defineProperty(window, 'URL', {
  value: {
    createObjectURL: jest.fn(() => 'mocked-url'),
    revokeObjectURL: jest.fn(),
  },
  writable: true,
});

// Mock document.createElement for download functionality
const originalCreateElement = document.createElement;
document.createElement = ((tagName: string) => {
  if (tagName === 'a') {
    const element = originalCreateElement.call(document, tagName) as HTMLAnchorElement;
    element.click = jest.fn();
    element.download = '';
    element.href = '';
    return element;
  }
  return originalCreateElement.call(document, tagName);
}) as typeof document.createElement;
