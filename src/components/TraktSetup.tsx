import { useEffect, useState } from 'react';
import { Alert, Box, Button, Link, Stack, TextField, Typography } from '@mui/material';
import browser from 'webextension-polyfill';

export const TraktSetup = (): JSX.Element => {
  const [clientId,setClientId] = useState('');
  const [clientSecret,setClientSecret] = useState('');
  const [message,setMessage] = useState('');
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  useEffect(() => { void browser.storage.local.get('traktApp').then(({traktApp}) => {
    setClientId(traktApp?.clientId || process.env.TRAKT_CLIENT_ID || '');
    setClientSecret(traktApp?.clientSecret || process.env.TRAKT_CLIENT_SECRET || '');
  }); },[]);
  const save = async () => {
    setBusy(true);setError('');setMessage('');
    try {
      if (!clientId.trim() || !clientSecret.trim()) throw new Error('Enter both values from your Trakt application.');
      // Prevent using a previous account token with a different application.
      await browser.storage.local.remove('auth');
      await browser.storage.sync.remove('auth');
      await browser.storage.local.set({traktApp: {clientId: clientId.trim(), clientSecret: clientSecret.trim()}});
      setMessage('Saved on this device. Reopen the BetterWatch popup to connect Trakt.');
    } catch(e) {setError(e instanceof Error ? e.message : 'Could not save Trakt setup. Try again.');}
    finally {setBusy(false);}
  };
  return <Box component="section" sx={{my:3}}>
    <Typography component="h2" variant="h5" sx={{fontWeight:700}}>Connect your watching</Typography>
    <Typography sx={{my:1}} color="text.secondary">Auto-skip works immediately. To track shows and movies, create your own <Link href="https://trakt.tv/oauth/applications/new" target="_blank" rel="noreferrer">Trakt application</Link>, enable its scrobble permission, and use this redirect URI:</Typography>
    <Box component="code" sx={{display:'block', overflowWrap:'anywhere',p:2,bgcolor:'action.hover',borderRadius:1,mb:2}}>{browser.identity.getRedirectURL()}</Box>
    <Stack spacing={2} component="form" onSubmit={event => {event.preventDefault();void save();}}>
      <TextField label="Trakt client ID" value={clientId} onChange={event => setClientId(event.target.value)} fullWidth autoComplete="off" />
      <TextField label="Trakt client secret" type="password" value={clientSecret} onChange={event => setClientSecret(event.target.value)} fullWidth autoComplete="off" />
      <Typography variant="caption" color="text.secondary">Saved in this Chrome profile, outside Chrome Sync. Changing the application disconnects your current Trakt session.</Typography>
      <Button type="submit" disabled={busy} variant="contained" sx={{alignSelf:'flex-start'}}>Save Trakt setup</Button>
      {message && <Alert severity="success">{message}</Alert>}
      {error && <Alert severity="error">{error}</Alert>}
    </Stack>
  </Box>;
};
