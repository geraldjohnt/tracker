// Tiny global toast queue: call toast() from anywhere (stores included), render <Toasts/> once per page.
type ToastItem = { id: number; msg: string; bad: boolean; leaving: boolean };
let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

export function toast(msg: string, bad = false) {
  const id = nextId++;
  items = [...items, { id, msg, bad, leaving: false }];
  emit();
  setTimeout(() => {
    items = items.map(t => (t.id === id ? { ...t, leaving: true } : t));
    emit();
    setTimeout(() => { items = items.filter(t => t.id !== id); emit(); }, 260);
  }, 2200);
}

export const toastStore = {
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
  get: () => items,
};
