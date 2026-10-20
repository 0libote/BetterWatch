import { Session } from '@common/Session';
import { Shared } from '@common/Shared';
import { loadTraktCredentials } from '@common/TraktCredentials';
import { useHistory } from '@contexts/HistoryContext';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import browser from 'webextension-polyfill';

export const LoginPage = (): JSX.Element => {
  const history = useHistory();
  const [loading,setLoading] = useState(true);
  const [configured,setConfigured] = useState(false);
  const [error,setError] = useState('');
  useEffect(() => {
    const success = () => {setLoading(false);history.push(Shared.redirectPath || '/home');};
    const failure = () => {setLoading(false);};
    Shared.events.subscribe('LOGIN_SUCCESS',null,success);
    Shared.events.subscribe('LOGIN_ERROR',null,failure);
    void loadTraktCredentials().then(value => {setConfigured(value);return Session.checkLogin();}).finally(() => setLoading(false));
    return () => {Shared.events.unsubscribe('LOGIN_SUCCESS',null,success);Shared.events.unsubscribe('LOGIN_ERROR',null,failure);};
  },[]);
  const login = async () => {
    setLoading(true);setError('');await Session.login();setLoading(false);
    if (!Session.isLoggedIn) setError('Trakt could not connect. Try again or check your application settings.');
  };
  return <Box>
    <Typography sx={{fontSize:15,fontWeight:700}}>Your watching, remembered.</Typography>
    <Typography variant="body2" color="text.secondary" sx={{mt:.4,mb:1.3}}>Connect Trakt to track shows and movies as you watch.</Typography>
    {loading ? <CircularProgress size={22} aria-label="Checking Trakt connection" /> :
      <Button variant="contained" size="small" onClick={() => configured ? void login() : void browser.runtime.openOptionsPage()}>{configured ? 'Connect Trakt' : 'Set up Trakt'}</Button>}
    {error && <Typography role="alert" color="error" variant="caption" sx={{display:'block',mt:1}}>{error}</Typography>}
  </Box>;
};
