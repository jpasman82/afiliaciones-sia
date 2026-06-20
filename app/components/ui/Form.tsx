// ============================================================================
//  app/components/ui/Form.tsx — Field, Input, Select, Textarea, SearchInput, Segmented
// ============================================================================
import { Icon, type IconName } from './Icon';

export const inputCls =
  'w-full rounded-lg bg-white ring-1 ring-inset ring-slate-300 px-3 py-2 text-sm text-slate-900 ' +
  'placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500 outline-none transition';

export function Field({ label, required, hint, className = '', children }:
  { label: string; required?: boolean; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-xs font-semibold text-slate-600 mb-1.5">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </span>
      {children}
      {hint && <span className="block text-[11px] text-slate-400 mt-1">{hint}</span>}
    </label>
  );
}

export function Input({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${inputCls} ${className}`} {...props} />;
}
export function Textarea({ className = '', ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${inputCls} resize-none ${className}`} {...props} />;
}
export function Select({ children, className = '', ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${inputCls} cursor-pointer pr-8 ${className}`} {...props}>{children}</select>;
}

export function SearchInput({ value, onChange, placeholder = 'Buscar…' }:
  { value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder?: string }) {
  return (
    <div className="relative flex-1 min-w-0">
      <Icon name="search" className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={2} />
      <input value={value} onChange={onChange} placeholder={placeholder}
        className="w-full rounded-lg bg-white ring-1 ring-inset ring-slate-300 pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500 outline-none transition" />
    </div>
  );
}

export function Segmented<T extends string>({ options, value, onChange }:
  { options: { value: T; label: string; icon?: IconName | string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-lg bg-slate-100 p-0.5 ring-1 ring-inset ring-slate-200">
      {options.map(o => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition
            ${value === o.value ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          {o.icon && <Icon name={o.icon} className="w-4 h-4" strokeWidth={2} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}
