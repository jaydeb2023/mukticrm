'use client';
import { useState } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth';
import LoginPage from '@/components/LoginPage';
import AppShell from '@/components/AppShell';

function Inner() {
  const { user } = useAuth();
  return user ? <AppShell /> : <LoginPage />;
}

export default function Home() {
  return (
    <AuthProvider>
      <Inner />
    </AuthProvider>
  );
}
