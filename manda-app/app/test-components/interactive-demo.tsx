"use client";

/**
 * Interactive Demo Component
 * Client Component demonstrating React 19.2 features and interactivity
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

export function InteractiveDemo() {
  const [count, setCount] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [items, setItems] = useState<string[]>([]);

  const handleAddItem = () => {
    if (inputValue.trim()) {
      setItems((prev) => [...prev, inputValue.trim()]);
      setInputValue("");
    }
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Interactive Client Component</CardTitle>
        <CardDescription>
          Uses &apos;use client&apos; directive for React 19.2 hooks and interactivity
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Counter Demo */}
        <div className="space-y-2">
          <Label>Counter (useState)</Label>
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCount((c) => c - 1)}
            >
              -
            </Button>
            <span className="min-w-[3rem] text-center text-2xl font-bold">
              {count}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCount((c) => c + 1)}
            >
              +
            </Button>
            <Button
              variant="secondary"
              onClick={() => setCount(0)}
            >
              Reset
            </Button>
          </div>
        </div>

        {/* Input Demo */}
        <div className="space-y-2">
          <Label htmlFor="interactive-input">Controlled Input</Label>
          <div className="flex gap-2">
            <Input
              id="interactive-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Type something..."
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleAddItem();
                }
              }}
            />
            <Button onClick={handleAddItem} disabled={!inputValue.trim()}>
              Add Item
            </Button>
          </div>
          {inputValue && (
            <p className="text-sm text-muted-foreground">
              Current value: <strong>{inputValue}</strong>
            </p>
          )}
        </div>

        {/* Dynamic List Demo */}
        <div className="space-y-2">
          <Label>Dynamic List ({items.length} items)</Label>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No items yet. Add some using the input above.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {items.map((item, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => handleRemoveItem(index)}
                >
                  {item} ×
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* React 19.2 Info */}
        <div className="rounded-lg border border-border bg-muted/50 p-4">
          <h4 className="mb-2 font-semibold">React 19.2 Features Used</h4>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>✓ useState hook for state management</li>
            <li>✓ Event handlers (onClick, onChange, onKeyDown)</li>
            <li>✓ Controlled form inputs</li>
            <li>✓ Conditional rendering</li>
            <li>✓ List rendering with keys</li>
            <li>✓ Server/Client Component interop</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
