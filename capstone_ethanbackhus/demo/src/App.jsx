import React, { useState, useEffect } from 'react';
import { createSession, getSolanaPay, getSession, startPayout } from './api';

export default function App() {
  const [name, setName] = useState('John Developer');
  const [email, setEmail] = useState('john@example.com');
  const [amount, setAmount] = useState(19999); // cents
  const [currency, setCurrency] = useState('USD');
  const [status, setStatus] = useState('idle');
  const [session, setSession] = useState(null);
  const [walletPubkey, setWalletPubkey] = useState(null);
  const [poller, setPoller] = useState(null);

  useEffect(() => {
    // If Phantom injected, detect and optionally auto-connect (ask user)
    if (window.solana && window.solana.isPhantom) {
      // Keep but do not auto-connect without user action.
      console.log('Phantom detected');
    }
    return () => {
      if (poller) clearInterval(poller);
    };
  }, [poller]);

  async function connectWallet() {
    if (!window.solana) {
      alert('No injected wallet found (Phantom). Install Phantom to test wallet flow.');
      return;
    }
    try {
      const resp = await window.solana.connect();
      setWalletPubkey(resp.publicKey.toString());
      console.log('connected', resp.publicKey.toString());
    } catch (err) {
      console.error('wallet connect error', err);
    }
  }

  async function handlePay() {
    setStatus('creating-session');
    try {
      // If we have a connected wallet, use its pubkey as payer otherwise leave blank
      const payer = walletPubkey || null;

      const payload = {
        payer: payer || 'REPLACE_WITH_PAYER_PUBKEY',
        amount,
        merchantId: 'demo-merchant',
        tokenMint: 'So11111111111111111111111111111111111111112' // example SOL wrapped or replace with USDC mint
      };

      const data = await createSession(payload);
      if (!data || !data.uuid) throw new Error('create-session failed');
      setSession(data);
      setStatus('session-created');

      // get Solana Pay URL and open wallet
      const sp = await getSolanaPay(data.uuid);
      const solanaPayUrl = sp.solanaPayUrl || sp.solana_pay_url || sp.solanaPay || null;
      if (!solanaPayUrl) {
        // If backend returns depositAddress instead, build basic solana: URL
        if (data.depositAddress && data.amount) {
          const amt = (data.amount / 100).toFixed(2);
          const built = `solana:${data.depositAddress}?amount=${amt}&reference=${data.uuid}`;
          openWallet(built);
        } else {
          alert('No solanaPay URL returned by backend');
        }
      } else {
        openWallet(solanaPayUrl);
      }

      // start polling
      setStatus('waiting-deposit');
      const iv = setInterval(async () => {
        try {
          const s = await getSession(data.uuid);
          setSession(s);
          if (s.status === 'Funded' || s.status === 'PendingFiat' || s.status === 'Settled' || s.status === 'Refunded' || s.status === 'Failed') {
            if (s.status === 'Funded') {
              // optional: trigger payout
              await startPayout(data.uuid, {});
            }
            setStatus(s.status);
            clearInterval(iv);
          }
        } catch (e) {
          console.error(e);
        }
      }, 2000);
      setPoller(iv);

    } catch (err) {
      console.error(err);
      setStatus('error');
      alert('Error creating session: ' + (err.message || err));
    }
  }

  function openWallet(url) {
    // Try to use window.solana's 'request' if available (not standardized) then fallback to deep-link open
    try {
      // Opening solana: URL in a new tab should open Phantom mobile/web if installed
      window.open(url, '_blank');
    } catch (e) {
      // fallback
      window.location.href = url;
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: '24px auto', padding: 20 }}>
      <div style={{ background: 'white', padding: 20, borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }}>
        <h1>Demo Checkout — Solana Pay (JS)</h1>
        <p style={{ color: '#6b7280' }}>Simple checkout that calls your backend to create a payment session and opens Phantom with Solana Pay URL.</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, marginTop: 18 }}>
          <div>
            <label style={{ fontSize: 13, color: '#6b7280' }}>Full name</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} />

            <label style={{ fontSize: 13, color: '#6b7280', marginTop: 8 }}>Email</label>
            <input className="input" value={email} onChange={e => setEmail(e.target.value)} />

            <label style={{ fontSize: 13, color: '#6b7280', marginTop: 8 }}>Amount (cents)</label>
            <input className="input" value={amount} onChange={e => setAmount(parseInt(e.target.value || '0'))} />

            <div style={{ marginTop: 12 }}>
              {walletPubkey ? (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 13, color: '#6b7280' }}>Connected wallet</div>
                  <div style={{ fontFamily: 'monospace', marginTop: 6 }}>{walletPubkey}</div>
                </div>
              ) : (
                <button className="btn" onClick={connectWallet}>Connect Phantom</button>
              )}
            </div>

            <div style={{ marginTop: 12 }}>
              <button className="btn" onClick={handlePay} disabled={status === 'creating-session' || status === 'waiting-deposit'}>
                {status === 'creating-session' ? 'Creating...' : 'Pay with Solana / Open Phantom'}
              </button>
            </div>
          </div>

          <div>
            <div style={{ background: '#f3f4f6', padding: 12, borderRadius: 8 }}>
              <div style={{ fontSize: 13, color: '#6b7280' }}>Status</div>
              <div style={{ fontWeight: 600, marginTop: 6 }}>{status}</div>

              <div style={{ marginTop: 12, fontSize: 13, color: '#6b7280' }}>Session</div>
              <pre style={{ fontSize: 12, marginTop: 8, whiteSpace: 'pre-wrap' }}>{JSON.stringify(session, null, 2)}</pre>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
