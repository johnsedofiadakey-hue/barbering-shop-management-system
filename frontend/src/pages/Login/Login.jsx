import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@hooks/useAuth';
import api from '@api';
import styles from './Login.module.scss';

import Form from '@components/common/Form/Form';
import Input from '@components/common/Input/Input';
import Button from '@components/common/Button/Button';
import Error from '@components/common/Error/Error';
import Spinner from '@components/common/Spinner/Spinner';
import Icon from '@components/common/Icon/Icon';
import heroImage from '@assets/images/portfolio/hero-barbershop.webp';

function Login({ initialStaffMode = false }) {
  const { loginWithOtp, loginWithFirebaseEmail, isAuthenticated, isLoggingIn, profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const staffMode = initialStaffMode;
  const [otpPhone, setOtpPhone] = useState(null);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const completingClientLogin = useRef(false);

  // Email is an optional, supplementary sign-in path for returning clients who added one —
  // phone/OTP stays the only way to create an account.
  const [loginMode, setLoginMode] = useState('phone'); // 'phone' | 'email'
  const [magicLinkEmail, setMagicLinkEmail] = useState(null);
  const [isSendingMagicLink, setIsSendingMagicLink] = useState(false);

  const nextPath = useMemo(() => {
    const requested = new URLSearchParams(location.search).get('next');
    return requested?.startsWith('/') && !requested.startsWith('//') ? requested : '/client/dashboard';
  }, [location.search]);

  const isReturningLogin = !staffMode && nextPath === '/client/dashboard';

  useEffect(() => {
    if (completingClientLogin.current || isLoggingIn || !isAuthenticated || !profile) return;
    const needsSetup = profile.role === 'CLIENT' && (!profile.name?.trim() || !profile.surname?.trim());
    navigate(needsSetup ? `/client/welcome?next=${encodeURIComponent(nextPath)}` : nextPath, { replace: true });
  }, [isLoggingIn, isAuthenticated, navigate, nextPath, profile]);

  if (isAuthenticated) return null;

  const handleRequestCode = async ({ phone_number }) => {
    setIsSendingCode(true);
    try {
      const normalized = phone_number.trim();
      await api.auth.requestOtp(normalized);
      setOtpPhone(normalized);
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleVerifyCode = async ({ code }) => {
    completingClientLogin.current = true;
    try {
      const session = await loginWithOtp(otpPhone, code.trim());
      const destination = session.requires_profile_setup ? `/client/welcome?next=${encodeURIComponent(nextPath)}` : nextPath;
      navigate(destination, { replace: true });
    } finally {
      completingClientLogin.current = false;
    }
  };

  const handleStaffFirebaseLogin = async ({ email, password }) => {
    await loginWithFirebaseEmail(email.trim(), password);
  };

  const handleRequestMagicLink = async ({ email }) => {
    setIsSendingMagicLink(true);
    try {
      await api.auth.requestMagicLink(email.trim());
      setMagicLinkEmail(email.trim());
    } finally {
      setIsSendingMagicLink(false);
    }
  };

  return (
    <div className={styles.loginPage}>
      <div className={styles.loginVisual}>
        <img src={heroImage} alt="Premium barbershop service" />
        <div className={styles.visualOverlay} />
        <div className={styles.visualCopy}>
          <span>Your chair is waiting</span>
          <h1>
            One number.
            <br />
            One quick code.
            <br />
            <em>You are in.</em>
          </h1>
          <p>No password for clients. Your appointments stay connected to your phone number.</p>
        </div>
      </div>

      <section className={styles.loginPanel}>
        <div className={styles.mobileIntro}>
          <span>
            {staffMode ? 'Customer care & team portal' : isReturningLogin ? 'Your client account' : 'Secure mobile booking'}
          </span>
          <h1>
            {staffMode
              ? 'Staff access'
              : loginMode === 'email'
                ? magicLinkEmail
                  ? 'Check your inbox'
                  : 'Sign in with email'
                : otpPhone
                  ? 'Check your messages'
                  : isReturningLogin
                    ? 'Welcome back'
                    : 'Book from your phone'}
          </h1>
          <p>
            {staffMode
              ? 'Sign in with the email linked to your staff account.'
              : loginMode === 'email'
                ? magicLinkEmail
                  ? `If ${magicLinkEmail} is on an account, a sign-in link is on its way.`
                  : 'We will email you a one-tap link — only works if you added this email in your account before.'
                : otpPhone
                  ? `Enter the six-digit code sent to ${otpPhone}.`
                  : isReturningLogin
                    ? 'Use the same phone number as before to open your appointments and history.'
                    : 'Simple, secure, and no client password to remember.'}
          </p>
        </div>

        <div className={styles.loginCard}>
          {!staffMode && loginMode === 'phone' && !otpPhone && (
            <Form initialFields={{ phone_number: '' }} onSubmit={handleRequestCode}>
              <div className={styles.formHeader}>
                <span className={styles.iconChip}>
                  <Icon name="dial" size="md" />
                </span>
                <div>
                  <small>Step 1 of 2</small>
                  <h2>Enter your phone</h2>
                </div>
              </div>
              <Input
                label="Mobile number"
                name="phone_number"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                placeholder="+233 24 000 0000"
                required
                disabled={isSendingCode}
                size="md"
              />
              <p className={styles.privacyNote}>
                We only use this number for secure login and appointment updates. You stay signed in on this phone until you log
                out.
              </p>
              <div id="firebase-recaptcha-container" />
              <Button type="submit" color="gold" size="lg" disabled={isSendingCode} wide>
                {isSendingCode ? (
                  <span className={styles.line}>
                    <Spinner size="sm" /> Sending code
                  </span>
                ) : (
                  'Continue'
                )}
              </Button>
              <Error />
              <Button type="button" color="link" size="sm" onClick={() => setLoginMode('email')} wide>
                Use email instead
              </Button>
            </Form>
          )}

          {!staffMode && loginMode === 'email' && !magicLinkEmail && (
            <Form initialFields={{ email: '' }} onSubmit={handleRequestMagicLink}>
              <div className={styles.formHeader}>
                <span className={styles.iconChip}>
                  <Icon name="email_base" size="md" />
                </span>
                <div>
                  <small>Email sign-in</small>
                  <h2>Enter your email</h2>
                </div>
              </div>
              <Input
                label="Email address"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                disabled={isSendingMagicLink}
                size="md"
              />
              <p className={styles.privacyNote}>
                Only works if you added this email to your account already. New here? Use your phone instead.
              </p>
              <Button type="submit" color="gold" size="lg" disabled={isSendingMagicLink} wide>
                {isSendingMagicLink ? (
                  <span className={styles.line}>
                    <Spinner size="sm" /> Sending link
                  </span>
                ) : (
                  'Email me a sign-in link'
                )}
              </Button>
              <Error />
              <Button
                type="button"
                color="link"
                size="sm"
                onClick={() => {
                  setLoginMode('phone');
                  setOtpPhone(null);
                }}
                wide
              >
                Use my phone instead
              </Button>
            </Form>
          )}

          {!staffMode && loginMode === 'email' && magicLinkEmail && (
            <div className={styles.magicLinkSent}>
              <p>
                Check <strong>{magicLinkEmail}</strong> for a one-tap sign-in link. It works once and expires soon.
              </p>
              <Button
                type="button"
                color="link"
                size="sm"
                onClick={() => {
                  setLoginMode('phone');
                  setMagicLinkEmail(null);
                }}
                wide
              >
                Use my phone instead
              </Button>
            </div>
          )}

          {!staffMode && loginMode === 'phone' && otpPhone && (
            <Form initialFields={{ code: '' }} onSubmit={handleVerifyCode}>
              <div className={styles.formHeader}>
                <span className={styles.iconChip}>
                  <Icon name="email_base" size="md" />
                </span>
                <div>
                  <small>Step 2 of 2</small>
                  <h2>Verify your code</h2>
                </div>
              </div>
              <Input
                label="Six-digit code"
                name="code"
                type="text"
                autoComplete="one-time-code"
                inputMode="numeric"
                placeholder="000000"
                required
                disabled={isLoggingIn}
                size="md"
              />
              <Button type="submit" color="gold" size="lg" disabled={isLoggingIn} wide>
                {isLoggingIn ? (
                  <span className={styles.line}>
                    <Spinner size="sm" /> Verifying
                  </span>
                ) : (
                  'Verify & continue'
                )}
              </Button>
              <Button type="button" color="link" size="sm" onClick={() => setOtpPhone(null)} wide>
                Use a different number
              </Button>
              <Error />
            </Form>
          )}

          {staffMode && (
            <Form initialFields={{ email: '', password: '' }} onSubmit={handleStaffFirebaseLogin}>
              <div className={styles.formHeader}>
                <span className={styles.iconChip}>
                  <Icon name="barber" size="md" />
                </span>
                <div>
                  <small>Team portal</small>
                  <h2>Staff login</h2>
                </div>
              </div>
              <Input label="Email" name="email" type="email" autoComplete="username" required disabled={isLoggingIn} size="md" />
              <Input
                label="Password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                disabled={isLoggingIn}
                size="md"
              />
              <Button type="submit" color="gold" size="lg" disabled={isLoggingIn} wide>
                {isLoggingIn ? (
                  <span className={styles.line}>
                    <Spinner size="sm" /> Signing in
                  </span>
                ) : (
                  'Sign in'
                )}
              </Button>
              <Error />
            </Form>
          )}

          <div className={styles.modeSwitch}>
            {staffMode ? (
              <>
                <span>Booking a cut or returning to your account?</span>
                <Button href="/login?next=%2Fclient%2Fdashboard" size="sm" color="link">
                  Use client login
                </Button>
              </>
            ) : (
              <span>New or returning client? Use the same secure phone login.</span>
            )}
          </div>
        </div>

        <div className={styles.loginBenefits}>
          {staffMode ? (
            <>
              <span>
                <Icon name="check" size="sm" /> Secure staff access
              </span>
              <span>
                <Icon name="appointment" size="sm" /> Manage operations
              </span>
              <span>
                <Icon name="settings" size="sm" /> Role-controlled tools
              </span>
            </>
          ) : (
            <>
              <span>
                <Icon name="check" size="sm" /> Stay signed in on this phone
              </span>
              <span>
                <Icon name="appointment" size="sm" /> Manage bookings
              </span>
              <span>
                <Icon name="email_base" size="sm" /> One-time SMS code
              </span>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export default Login;
