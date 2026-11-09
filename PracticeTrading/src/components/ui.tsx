import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { X } from 'lucide-react';

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
const buttonVariants = cva('button', { variants: { variant: { default: 'button-primary', outline: 'button-outline', ghost: 'button-ghost', destructive: 'button-danger' }, size: { default: '', icon: 'button-icon', sm: 'button-sm' } }, defaultVariants: { variant: 'default', size: 'default' } });
export function Button({ className, variant, size, asChild = false, ...props }: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Component = asChild ? Slot : 'button';
  return <Component className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
export function Dialog({ open, onOpenChange, title, description, children }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description?: string; children: React.ReactNode }) {
  return <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}><DialogPrimitive.Portal><DialogPrimitive.Overlay className="dialog-overlay" /><DialogPrimitive.Content className="dialog-content"><div className="dialog-heading"><DialogPrimitive.Title>{title}</DialogPrimitive.Title><DialogPrimitive.Close asChild><Button variant="ghost" size="icon" aria-label="Close dialog"><X size={18} /></Button></DialogPrimitive.Close></div><DialogPrimitive.Description className={description ? 'muted dialog-description' : 'sr-only'}>{description ?? title}</DialogPrimitive.Description>{children}</DialogPrimitive.Content></DialogPrimitive.Portal></DialogPrimitive.Root>;
}
export function ConfirmDialog({ stage, action = 'all', onCancel, onContinue }: { stage: number; action?: 'all' | 'records'; onCancel: () => void; onContinue: () => void }) {
  const isRecordsOnly = action === 'records';
  const title = stage === 1 ? (isRecordsOnly ? 'Clear all answers and trades?' : 'Clear all your data?') : 'This is the final confirmation';
  const description = stage === 1
    ? isRecordsOnly ? 'All daily checklist answers and trading results, including notes, from every date and month will be permanently cleared. Your checklist sections, questions, and templates will be kept.' : 'All checklist sections, questions, daily answers, and trading records from every month will be permanently cleared. This cannot be undone.'
    : isRecordsOnly ? 'Confirm once more to permanently remove every daily answer and all trade results and notes across all months. Your checklist and question templates will remain.' : 'Are you absolutely sure? Your journal will be reset to an empty state, without sample templates. There is no way to recover deleted data.';
  return <AlertDialogPrimitive.Root open={stage > 0}><AlertDialogPrimitive.Portal><AlertDialogPrimitive.Overlay className="dialog-overlay" /><AlertDialogPrimitive.Content className="dialog-content"><AlertDialogPrimitive.Title>{title}</AlertDialogPrimitive.Title><AlertDialogPrimitive.Description className="dialog-description muted">{description}</AlertDialogPrimitive.Description><div className="dialog-actions"><Button variant="outline" onClick={onCancel}>Cancel</Button><Button variant="destructive" onClick={onContinue}>{stage === 1 ? 'Continue to confirmation' : isRecordsOnly ? 'Yes, clear answers and trades' : 'Yes, permanently delete everything'}</Button></div></AlertDialogPrimitive.Content></AlertDialogPrimitive.Portal></AlertDialogPrimitive.Root>;
}