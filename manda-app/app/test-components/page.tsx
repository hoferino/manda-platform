/**
 * Test Components Page
 * Demonstrates integration of Next.js 16, React 19.2, Tailwind CSS 4, and shadcn/ui
 * This is a Server Component by default
 */

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { InteractiveDemo } from "./interactive-demo";

export default function TestComponentsPage() {
  return (
    <main className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Header */}
        <header className="space-y-2">
          <h1 className="text-4xl font-bold text-foreground">
            Component Test Page
          </h1>
          <p className="text-muted-foreground">
            Manda M&A Intelligence Platform - Frontend Stack Verification
          </p>
          <div className="flex gap-2">
            <Badge>Next.js 16</Badge>
            <Badge variant="secondary">React 19.2</Badge>
            <Badge variant="outline">Tailwind CSS 4</Badge>
            <Badge variant="destructive">shadcn/ui</Badge>
          </div>
        </header>

        {/* Server Component Section */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Server Components (Default)</h2>
          <Card>
            <CardHeader>
              <CardTitle>Server-Rendered Card</CardTitle>
              <CardDescription>
                This card is rendered on the server (no &apos;use client&apos; directive)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Server Components are the default in Next.js App Router. They render on the server
                and send HTML to the client, reducing JavaScript bundle size.
              </p>

              {/* Static Buttons */}
              <div className="flex flex-wrap gap-2">
                <Button>Default</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="link">Link</Button>
                <Button variant="destructive">Destructive</Button>
              </div>

              {/* Button Sizes */}
              <div className="flex items-center gap-2">
                <Button size="sm">Small</Button>
                <Button size="default">Default</Button>
                <Button size="lg">Large</Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Tailwind CSS 4 OKLCH Colors Demo */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">OKLCH Color Palette</h2>
          <Card>
            <CardHeader>
              <CardTitle>Tailwind CSS 4 with OKLCH</CardTitle>
              <CardDescription>
                Perceptually uniform colors using OKLCH color space
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <div className="h-16 rounded-lg bg-primary" />
                  <Label className="text-xs">Primary</Label>
                </div>
                <div className="space-y-2">
                  <div className="h-16 rounded-lg bg-secondary" />
                  <Label className="text-xs">Secondary</Label>
                </div>
                <div className="space-y-2">
                  <div className="h-16 rounded-lg bg-muted" />
                  <Label className="text-xs">Muted</Label>
                </div>
                <div className="space-y-2">
                  <div className="h-16 rounded-lg bg-accent" />
                  <Label className="text-xs">Accent</Label>
                </div>
                <div className="space-y-2">
                  <div className="h-16 rounded-lg bg-destructive" />
                  <Label className="text-xs">Destructive</Label>
                </div>
                <div className="space-y-2">
                  <div className="h-16 rounded-lg bg-card border" />
                  <Label className="text-xs">Card</Label>
                </div>
                <div className="space-y-2">
                  <div className="h-16 rounded-lg bg-popover border" />
                  <Label className="text-xs">Popover</Label>
                </div>
                <div className="space-y-2">
                  <div className="h-16 rounded-lg border-2 border-border" />
                  <Label className="text-xs">Border</Label>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Form Elements */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Form Components</h2>
          <Card>
            <CardHeader>
              <CardTitle>Input & Label Components</CardTitle>
              <CardDescription>
                shadcn/ui form elements with proper accessibility
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input id="email" type="email" placeholder="you@example.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" placeholder="Enter password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="disabled">Disabled Input</Label>
                <Input id="disabled" disabled placeholder="Cannot edit" />
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full">Submit Form</Button>
            </CardFooter>
          </Card>
        </section>

        {/* Client Component Section */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Client Components (Interactive)</h2>
          <InteractiveDemo />
        </section>

        {/* Tailwind Utilities Demo */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Tailwind Utilities</h2>
          <Card>
            <CardHeader>
              <CardTitle>Layout & Spacing</CardTitle>
              <CardDescription>
                Demonstrating Tailwind CSS 4 utility classes
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Flexbox */}
              <div className="mb-4">
                <Label className="mb-2 block">Flexbox</Label>
                <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                  <div className="h-10 w-10 rounded bg-primary" />
                  <div className="h-10 flex-1 rounded bg-secondary" />
                  <div className="h-10 w-20 rounded bg-accent" />
                </div>
              </div>

              {/* Grid */}
              <div className="mb-4">
                <Label className="mb-2 block">CSS Grid</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div
                      key={i}
                      className="flex h-16 items-center justify-center rounded-lg bg-muted text-sm font-medium"
                    >
                      {i}
                    </div>
                  ))}
                </div>
              </div>

              {/* Responsive Design */}
              <div>
                <Label className="mb-2 block">Responsive (resize window)</Label>
                <div className="rounded-lg border p-4 text-center">
                  <span className="block sm:hidden">Mobile View</span>
                  <span className="hidden sm:block md:hidden">Tablet View</span>
                  <span className="hidden md:block lg:hidden">Desktop View</span>
                  <span className="hidden lg:block">Large Desktop View</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Footer */}
        <footer className="border-t pt-8 text-center text-sm text-muted-foreground">
          <p>Manda M&A Intelligence Platform - Epic 1 Story 1.1</p>
          <p className="mt-1">
            Next.js 16 | React 19.2 | Tailwind CSS 4 | shadcn/ui
          </p>
        </footer>
      </div>
    </main>
  );
}
