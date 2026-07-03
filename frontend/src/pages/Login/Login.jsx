import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@hooks/useAuth';
import { isEmail } from '@utils/utils';
import styles from './Login.module.scss';
import api from '@api';

import Spinner from '@components/common/Spinner/Spinner';
import Card from '@components/common/Card/Card';
import Form from '@components/common/Form/Form';
import Input from '@components/common/Input/Input';
import Button from '@components/common/Button/Button';
import Error from '@components/common/Error/Error';
import Hero from '@components/ui/Hero/Hero';
import SidePanel from '@components/ui/SidePanel/SidePanel';
import Icon from '@components/common/Icon/Icon';

function Login() {
  const { login, loginWithOtp, isAuthenticated, isLoggingIn } = useAuth();
  const navigate = useNavigate();

  const [staffMode, setStaffMode] = useState(false); // false = client phone/OTP login, true = barber/admin password login
  const [otpPhone, setOtpPhone] = useState(null); // set once a code has been sent, moves the OTP form to step 2
  const [isSendingCode, setIsSendingCode] = useState(false);

  /**
   * On authentication state change, redirect authenticated users away from login.
   */
  useEffect(() => {
    if (!isLoggingIn && isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isLoggingIn, isAuthenticated, navigate]);

  // Don't show login if redirecting
  if (isAuthenticated) return null;

  /**
   * Step 1 (client): request an OTP code for the entered phone number.
   */
  const handleRequestCode = async ({ phone_number }) => {
    setIsSendingCode(true);

    try {
      await api.auth.requestOtp(phone_number.trim());
      setOtpPhone(phone_number.trim());
    } finally {
      setIsSendingCode(false);
    }
  };

  /**
   * Step 2 (client): verify the received code and log in.
   */
  const handleVerifyCode = async ({ code }) => {
    await loginWithOtp(otpPhone, code.trim()); // The AuthProvider will redirect due to isAuthenticated update.
  };

  /**
   * Staff (barber/admin): classic identifier + password login.
   */
  const handleStaffLogin = async ({ identifier, password }) => {
    const payload = isEmail(identifier) ? { email: identifier, password } : { username: identifier, password };
    await login(payload); // The AuthProvider will redirect due to isAuthenticated update.
  };

  return (
    <Hero>
      <Hero.Left>
        <SidePanel heading="Welcome back" subheading="Your barber, one text away">
          <SidePanel.Inner>
            <div className={styles.description}>
              <h2>Log in with just your phone</h2>
              <ul className={styles.features}>
                <li>
                  <Icon name="dial" size="sm" />
                  <p>No password needed — we text you a code.</p>
                </li>
                <li>
                  <Icon name="appointment" size="sm" />
                  <p>See, reschedule or cancel your bookings.</p>
                </li>
                <li>
                  <Icon name="review" size="sm" />
                  <p>Review your barber after your cut.</p>
                </li>
              </ul>
            </div>
          </SidePanel.Inner>

          <SidePanel.Actions>
            <p className={styles.note}>First time? Just enter your number — your account is created automatically.</p>
          </SidePanel.Actions>
        </SidePanel>
      </Hero.Left>

      <Hero.Right className={styles.rightPanel}>
        <Card className={styles.login}>
          {staffMode ? (
            <Form className={styles.loginForm} initialFields={{ identifier: '', password: '' }} onSubmit={handleStaffLogin}>
              <h2 className={styles.label}>Staff login</h2>

              <Input
                label="Email or username"
                name="identifier"
                type="text"
                autoComplete="username"
                required
                disabled={isLoggingIn}
                size="md"
              />

              <Input
                label="Password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                disabled={isLoggingIn}
                size="md"
              />

              <Button className={styles.loginBtn} type="submit" color="gold" size="md" disabled={isLoggingIn} wide>
                <span className={styles.line}>
                  {isLoggingIn ? (
                    <>
                      <Spinner size={'sm'} /> Logging in...
                    </>
                  ) : (
                    'Login'
                  )}
                </span>
              </Button>

              <Button className={styles.forgotBtn} href="/reset-password" size="sm" color="link">
                Forgot password?
              </Button>

              <Error />
            </Form>
          ) : otpPhone ? (
            <Form className={styles.loginForm} initialFields={{ code: '' }} onSubmit={handleVerifyCode}>
              <h2 className={styles.label}>Enter your code</h2>
              <p className={styles.otpHint}>
                We sent a 6-digit code to <strong>{otpPhone}</strong>
              </p>

              <Input
                label="Verification code"
                name="code"
                type="text"
                autoComplete="one-time-code"
                inputMode="numeric"
                required
                disabled={isLoggingIn}
                size="md"
              />

              <Button className={styles.loginBtn} type="submit" color="gold" size="md" disabled={isLoggingIn} wide>
                <span className={styles.line}>
                  {isLoggingIn ? (
                    <>
                      <Spinner size={'sm'} /> Verifying...
                    </>
                  ) : (
                    'Verify & login'
                  )}
                </span>
              </Button>

              <Button className={styles.forgotBtn} type="button" size="sm" color="link" onClick={() => setOtpPhone(null)}>
                Use a different number
              </Button>

              <Error />
            </Form>
          ) : (
            <Form className={styles.loginForm} initialFields={{ phone_number: '' }} onSubmit={handleRequestCode}>
              <h2 className={styles.label}>Login</h2>
              <p className={styles.otpHint}>Enter your phone number and we&apos;ll text you a login code.</p>

              <Input
                label="Phone number"
                name="phone_number"
                type="tel"
                autoComplete="tel"
                placeholder="+15551234567"
                required
                disabled={isSendingCode}
                size="md"
              />

              <Button className={styles.loginBtn} type="submit" color="gold" size="md" disabled={isSendingCode} wide>
                <span className={styles.line}>
                  {isSendingCode ? (
                    <>
                      <Spinner size={'sm'} /> Sending code...
                    </>
                  ) : (
                    'Send code'
                  )}
                </span>
              </Button>

              <Error />
            </Form>
          )}

          <Button
            className={styles.staffToggle}
            type="button"
            size="sm"
            color="link"
            onClick={() => {
              setStaffMode((v) => !v);
              setOtpPhone(null);
            }}
          >
            {staffMode ? 'Client login (phone number)' : 'Barber or admin? Staff login'}
          </Button>
        </Card>
      </Hero.Right>
    </Hero>
  );
}

export default Login;
