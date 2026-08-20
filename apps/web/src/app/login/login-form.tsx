'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Info, Loader2, Lock, Mail } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import type { OtpChallenge, Session } from '@/lib/types';

type Step = 'email' | 'code';

export function LoginForm(): JSX.Element {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading, signIn } = useAuth();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const codeInput = useRef<HTMLInputElement>(null);

  // Someone already signed in has no business on this screen.
  useEffect(() => {
    if (!loading && user) router.replace('/dashboard');
  }, [loading, user, router]);

  useEffect(() => {
    if (params.get('expired')) {
      toast.info('Your session expired. Please sign in again.');
    }
  }, [params]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const requestCode = useCallback(
    async (address: string, { silent = false }: { silent?: boolean } = {}) => {
      setSubmitting(true);
      setError(null);

      try {
        const next = await api.anonymous.post<OtpChallenge>('/auth/request-otp', {
          email: address,
        });

        setChallenge(next);
        setStep('code');
        setResendIn(next.resendInSeconds);
        // Email delivery is off on this deployment, so the API hands the code
        // back and we fill it in — a reviewer never needs an inbox.
        setCode(next.devCode ?? '');
        if (!silent) toast.success('Code issued.');
        setTimeout(() => codeInput.current?.focus(), 50);
      } catch (cause) {
        const message =
          cause instanceof ApiError ? cause.detail : 'Could not reach the API. Is it running?';
        setError(message);
      } finally {
        setSubmitting(false);
      }
    },
    [],
  );

  const onSubmitEmail = (event: FormEvent): void => {
    event.preventDefault();
    void requestCode(email.trim().toLowerCase());
  };

  const onSubmitCode = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const session = await api.anonymous.post<Session>('/auth/verify-otp', {
        email: email.trim().toLowerCase(),
        code: code.trim(),
      });

      signIn(session);
      toast.success(`Welcome back, ${session.user.name ?? session.user.email}.`);
      router.replace('/dashboard');
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.detail : 'Could not verify that code.');
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            AF
          </div>
          <div>
            <h1 className="text-base font-semibold leading-tight">Advani Family Office</h1>
            <p className="text-sm text-muted-foreground">Internal dashboard</p>
          </div>
        </div>

        <Card>
          <CardContent className="p-6">
            {step === 'email' ? (
              <form onSubmit={onSubmitEmail} className="flex flex-col gap-4">
                <div>
                  <h2 className="text-sm font-semibold">Sign in</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    We will send a six-digit code to your work address. No password required.
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email">Work email</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      autoFocus
                      required
                      className="pl-9"
                      placeholder="you@advanifamilyoffice.com"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  </div>
                </div>

                {error ? <p className="text-sm text-negative">{error}</p> : null}

                <Button type="submit" disabled={submitting || email.trim().length === 0}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Send code
                </Button>
              </form>
            ) : (
              <form onSubmit={onSubmitCode} className="flex flex-col gap-4">
                <div>
                  <h2 className="text-sm font-semibold">Enter your code</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Sent to <span className="font-medium text-foreground">{email}</span>
                  </p>
                </div>

                {challenge?.devCode ? (
                  <div className="flex gap-2.5 rounded-md border border-warning/30 bg-warning/10 p-3">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                    <p className="text-xs leading-relaxed text-foreground">
                      Email delivery is disabled on this test dashboard, so your code is shown
                      here:{' '}
                      <span className="font-mono font-semibold tabular">{challenge.devCode}</span>{' '}
                      — already filled in below, just press Verify.
                    </p>
                  </div>
                ) : null}

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="code">Six-digit code</Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="code"
                      ref={codeInput}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      required
                      className="pl-9 font-mono text-base tracking-[0.35em] tabular"
                      placeholder="000000"
                      value={code}
                      onChange={(event) =>
                        setCode(event.target.value.replace(/\D/g, '').slice(0, 6))
                      }
                    />
                  </div>
                </div>

                {error ? <p className="text-sm text-negative">{error}</p> : null}

                <Button type="submit" disabled={submitting || code.length !== 6}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Verify and sign in
                </Button>

                <div className="flex items-center justify-between">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setStep('email');
                      setError(null);
                      setCode('');
                    }}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Change email
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={resendIn > 0 || submitting}
                    onClick={() => void requestCode(email.trim().toLowerCase())}
                  >
                    {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Staff access only. Every change is recorded in the audit log.
        </p>
      </div>
    </main>
  );
}
