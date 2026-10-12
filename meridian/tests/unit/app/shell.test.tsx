import { existsSync } from 'node:fs';
import path from 'node:path';

import type { ComponentPropsWithoutRef, ReactElement, ReactNode, Ref } from 'react';

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  queryClientCtors: 0,
  pathname: '/',
  resolvedTheme: 'light' as string | undefined,
  setTheme: vi.fn(),
  themeProviderProps: {} as Record<string, unknown>,
  hydrated: true,
}));

vi.mock('next-themes', async () => {
  const React = await import('react');
  return {
    ThemeProvider: (props: { children?: ReactNode } & Record<string, unknown>) => {
      state.themeProviderProps = props;
      return React.createElement(React.Fragment, null, props.children);
    },
    useTheme: () => ({
      resolvedTheme: state.resolvedTheme,
      theme: state.resolvedTheme,
      setTheme: state.setTheme,
      themes: ['light', 'dark', 'system'],
    }),
  };
});

vi.mock('next/navigation', () => ({
  usePathname: () => state.pathname,
}));

vi.mock('next/link', async () => {
  const React = await import('react');
  const resolve = (href: unknown): string => {
    if (typeof href === 'string') return href;
    if (href && typeof href === 'object' && 'pathname' in href) {
      const value = (href as { pathname?: unknown }).pathname;
      if (typeof value === 'string') return value;
    }
    return '#';
  };
  const Link = React.forwardRef(function Link(
    props: { href?: unknown; children?: ReactNode; className?: string; 'aria-label'?: string },
    ref: Ref<HTMLAnchorElement>,
  ) {
    return React.createElement(
      'a',
      {
        ref,
        href: resolve(props.href),
        className: props.className,
        'aria-label': props['aria-label'],
      },
      props.children,
    );
  });
  return { default: Link };
});

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  const QueryClient = vi.fn(function (
    this: unknown,
    options?: ConstructorParameters<typeof actual.QueryClient>[0],
  ) {
    state.queryClientCtors += 1;
    return new actual.QueryClient(options);
  }) as unknown as typeof actual.QueryClient;
  return { ...actual, QueryClient };
});

vi.mock('@/components/ui/button', async () => {
  const React = await import('react');
  const Button = React.forwardRef(function Button(
    props: ComponentPropsWithoutRef<'button'>,
    ref: Ref<HTMLButtonElement>,
  ) {
    return React.createElement('button', { ref, type: 'button', ...props });
  });
  return { Button, buttonVariants: () => '' };
});

vi.mock('@/components/ui/sheet', async () => {
  const React = await import('react');
  const withRender = (
    tag: 'button' | 'span',
    props: { render?: ReactElement; children?: ReactNode },
  ) =>
    props.render
      ? React.cloneElement(props.render, {}, props.children)
      : React.createElement(tag, null, props.children);
  return {
    Sheet: (props: { children?: ReactNode }) =>
      React.createElement(React.Fragment, null, props.children),
    SheetTrigger: (props: { render?: ReactElement; children?: ReactNode }) =>
      withRender('button', props),
    SheetClose: (props: { render?: ReactElement; children?: ReactNode }) =>
      withRender('span', props),
    SheetContent: (props: { children?: ReactNode }) =>
      React.createElement('div', { 'data-testid': 'sheet-content' }, props.children),
    SheetHeader: (props: { children?: ReactNode }) =>
      React.createElement('div', null, props.children),
    SheetTitle: (props: { children?: ReactNode }) =>
      React.createElement('h2', null, props.children),
    SheetDescription: (props: { children?: ReactNode }) =>
      React.createElement('p', null, props.children),
    SheetFooter: (props: { children?: ReactNode }) =>
      React.createElement('div', null, props.children),
  };
});

vi.mock('@/components/ui/tooltip', async () => {
  const React = await import('react');
  return {
    TooltipProvider: (props: { children?: ReactNode }) =>
      React.createElement('div', { 'data-testid': 'tooltip-provider' }, props.children),
    Tooltip: (props: { children?: ReactNode }) =>
      React.createElement(React.Fragment, null, props.children),
    TooltipTrigger: (props: { render?: ReactElement; children?: ReactNode }) =>
      props.render
        ? React.cloneElement(props.render, {}, props.children)
        : React.createElement(React.Fragment, null, props.children),
    TooltipContent: (props: { children?: ReactNode }) =>
      React.createElement(React.Fragment, null, props.children),
  };
});

vi.mock('@/components/ui/sonner', async () => {
  const React = await import('react');
  return {
    Toaster: (props: Record<string, unknown>) =>
      React.createElement('div', { 'data-testid': 'app-toaster', ...props }),
  };
});

vi.mock('@/hooks/use-hydrated', () => ({
  useHydrated: () => state.hydrated,
}));

import StorefrontLayout from '@/app/(storefront)/layout';
import StudioLayout from '@/app/studio/layout';
import { Providers } from '@/app/providers';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { StudioShell } from '@/components/studio-shell';
import { ThemeToggle } from '@/components/theme-toggle';
import { useCartStore } from '@/lib/state';

const cartLine = {
  productId: 1,
  title: 'Field Jacket',
  thumbnail: '/field-jacket.webp',
  price: 120,
  discountPercentage: 0,
  quantity: 3,
};

function routeExists(href: string): boolean {
  const segments = href.split('/').filter(Boolean);
  const roots = [
    path.join(process.cwd(), 'app', ...segments, 'page.tsx'),
    path.join(process.cwd(), 'app', '(storefront)', ...segments, 'page.tsx'),
  ];
  if (segments.length === 0) {
    roots.push(path.join(process.cwd(), 'app', 'page.tsx'));
    roots.push(path.join(process.cwd(), 'app', '(storefront)', 'page.tsx'));
  }
  return roots.some((candidate) => existsSync(candidate));
}

beforeEach(() => {
  state.queryClientCtors = 0;
  state.pathname = '/';
  state.resolvedTheme = 'light';
  state.hydrated = true;
  state.setTheme.mockReset();
  useCartStore.setState({ lines: [] });
});

afterEach(() => {
  cleanup();
  useCartStore.setState({ lines: [] });
});

describe('app providers', () => {
  it('creates exactly one QueryClient across re-renders', () => {
    const { rerender } = render(
      <Providers>
        <div>app content</div>
      </Providers>,
    );
    rerender(
      <Providers>
        <div>app content</div>
      </Providers>,
    );
    expect(state.queryClientCtors).toBe(1);
  });

  it('renders children and configures the theme provider', () => {
    render(
      <Providers>
        <div>app content</div>
      </Providers>,
    );
    expect(screen.getByText('app content')).toBeInTheDocument();
    expect(state.themeProviderProps.attribute).toBe('class');
    expect(state.themeProviderProps.defaultTheme).toBe('system');
    expect(state.themeProviderProps.enableSystem).toBe(true);
  });

  it('mounts the toaster and tooltip provider app-wide', () => {
    render(
      <Providers>
        <div>app content</div>
      </Providers>,
    );
    expect(screen.getByTestId('app-toaster')).toBeInTheDocument();
    expect(screen.getByTestId('tooltip-provider')).toBeInTheDocument();
  });
});

describe('storefront shell', () => {
  it('renders header, main landmark and footer around children', () => {
    render(
      <StorefrontLayout>
        <p>storefront content</p>
      </StorefrontLayout>,
    );
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByText('storefront content')).toBeInTheDocument();
  });
});

describe('studio shell', () => {
  it('renders a distinct merchant shell without storefront chrome', () => {
    state.pathname = '/studio';
    render(
      <StudioShell>
        <p>studio content</p>
      </StudioShell>,
    );
    expect(screen.getAllByRole('navigation', { name: 'Studio' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Shop' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('main')).toHaveTextContent('studio content');
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
  });
});

describe('studio layout', () => {
  it('wraps children in the studio shell', () => {
    state.pathname = '/studio';
    render(
      <StudioLayout>
        <p>studio page</p>
      </StudioLayout>,
    );
    expect(screen.getByText('studio page')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });
});

describe('navigation targets', () => {
  it('header links all resolve to real routes', () => {
    render(<SiteHeader />);
    const internal = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href') ?? '')
      .filter((href) => href.startsWith('/'));
    expect(internal.length).toBeGreaterThan(0);
    for (const href of internal) {
      expect(routeExists(href), 'missing route for ' + href).toBe(true);
    }
  });

  it('footer internal links resolve and external links open safely', () => {
    render(<SiteFooter />);
    const internal = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href') ?? '')
      .filter((href) => href.startsWith('/'));
    for (const href of internal) {
      expect(routeExists(href), 'missing route for ' + href).toBe(true);
    }
    const external = screen.getByRole('link', { name: 'DummyJSON API' });
    expect(external).toHaveAttribute('target', '_blank');
    expect(external).toHaveAttribute('rel', 'noreferrer');
  });
});

describe('cart indicator', () => {
  it('does not render a count before hydration completes', () => {
    state.hydrated = false;
    useCartStore.setState({ lines: [cartLine] });
    render(<SiteHeader />);
    expect(screen.getByLabelText('Open cart')).toBeInTheDocument();
    expect(screen.queryByLabelText('Open cart, 3 items')).not.toBeInTheDocument();
  });

  it('renders the persisted item count once hydrated', () => {
    state.hydrated = true;
    useCartStore.setState({ lines: [cartLine] });
    render(<SiteHeader />);
    expect(screen.getByLabelText('Open cart, 3 items')).toBeInTheDocument();
  });
});

describe('theme toggle', () => {
  it('requests the opposite theme on click', async () => {
    state.resolvedTheme = 'light';
    const user = userEvent.setup();
    render(<ThemeToggle />);
    const button = await screen.findByRole('button', { name: 'Switch to dark theme' });
    await user.click(button);
    expect(state.setTheme).toHaveBeenCalledWith('dark');
  });

  it('switches back to light from dark', async () => {
    state.resolvedTheme = 'dark';
    const user = userEvent.setup();
    render(<ThemeToggle />);
    const button = await screen.findByRole('button', { name: 'Switch to light theme' });
    await user.click(button);
    expect(state.setTheme).toHaveBeenCalledWith('light');
  });
});
