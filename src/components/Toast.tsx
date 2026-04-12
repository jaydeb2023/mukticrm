'use client';
import { useEffect, useState } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warn';
let _showToast: ((msg: string, type?: ToastType) => void) | null = null;

export function showToast(msg: string, type: ToastType = 'info') {
  _showToast?.(msg, type);
}

export default function Toast() {
  const [msg, setMsg] = useState('');
  const [type, setType] = useState<ToastType>('info');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    _showToast = (m, t = 'info') => {
      setMsg(m); setType(t); setVisible(true);
      setTimeout(() => setVisible(false), 3000);
    };
    return () => { _showToast = null; };
  }, []);

  return (
    <div
      id="toast"
      className={visible ? `show ${type}` : type}
      style={{ display: msg ? undefined : 'none' }}
    >
      {msg}
    </div>
  );
}
