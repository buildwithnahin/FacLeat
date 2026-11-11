'use client';

import * as React from 'react';
import { ScanBarcode, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface ScanInputProps {
  value?: string;
  placeholder?: string;
  autoFocus?: boolean;
  continuousDefault?: boolean;
  className?: string;
  onChange?: (value: string) => void;
  onScan: (value: string) => void;
}

function beep() {
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) return;
  const ctx = new AudioContextCtor();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = 880;
  gain.gain.value = 0.04;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  window.setTimeout(() => {
    osc.stop();
    void ctx.close();
  }, 70);
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

export function ScanInput({
  value,
  placeholder = 'Scan or enter code',
  autoFocus = true,
  continuousDefault = true,
  className,
  onChange,
  onScan,
}: ScanInputProps) {
  const [innerValue, setInnerValue] = React.useState(value ?? '');
  const [continuous, setContinuous] = React.useState(continuousDefault);
  const ref = React.useRef<HTMLInputElement>(null);
  const currentValue = value ?? innerValue;

  React.useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  const submit = () => {
    const code = currentValue.trim();
    if (!code) return;
    onScan(code);
    beep();
    if (value === undefined) setInnerValue('');
    onChange?.('');
    if (continuous) window.setTimeout(() => ref.current?.focus(), 0);
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="relative flex-1">
        <ScanBarcode className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={ref}
          value={currentValue}
          placeholder={placeholder}
          className="pl-9"
          onChange={(event) => {
            if (value === undefined) setInnerValue(event.target.value);
            onChange?.(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              submit();
            }
          }}
        />
      </div>
      <Button type="button" size="icon" variant={continuous ? 'default' : 'outline'} onClick={() => setContinuous((v) => !v)} title="Continuous scan">
        <Volume2 className="h-4 w-4" />
      </Button>
      <Button type="button" variant="outline" onClick={submit}>
        <ScanBarcode className="h-4 w-4" />
        Scan
      </Button>
    </div>
  );
}
