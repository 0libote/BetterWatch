import { useEffect, useState } from 'react';
import { Alert, Box, FormControlLabel, Stack, Switch, Tab, Tabs, Typography } from '@mui/material';
import browser from 'webextension-polyfill';
import { normalizeSettings, SERVICE_IDS, SERVICE_NAMES, SkipPreferences, SkipService, serviceForHost } from '../skip/model';

export const SkipControls = (): JSX.Element => {
  const [service,setService] = useState<SkipService>('netflix');
  const [settings,setSettings] = useState(normalizeSettings(null));
  const [ready,setReady] = useState(false);
  const [error,setError] = useState('');
  useEffect(() => {
    void browser.storage.local.get('skipSettings').then(data => {setSettings(normalizeSettings(data.skipSettings));setReady(true);});
    void browser.tabs.query({active: true, currentWindow: true}).then(tabs => {
      if (tabs[0]?.url) {const id = serviceForHost(new URL(tabs[0].url).hostname); if(id) setService(id);}
    });
    const listener = (changes: Record<string, browser.Storage.StorageChange>, area: string) => {
      if (area === 'local' && changes.skipSettings) setSettings(normalizeSettings(changes.skipSettings.newValue));
    };
    browser.storage.onChanged.addListener(listener);
    return () => browser.storage.onChanged.removeListener(listener);
  },[]);
  const update = async (key: keyof SkipPreferences, value: boolean) => {
    try {
      const latest = normalizeSettings((await browser.storage.local.get('skipSettings')).skipSettings);
      latest[service] = {...latest[service], [key]: value};
      await browser.storage.local.set({skipSettings: latest});
      setSettings(latest); setError('');
    } catch { setError('Could not save. Try changing the setting again.'); }
  };
  const prefs = settings[service];
  return <Box>
    <Typography component="h2" variant="h6" sx={{fontSize: 18, fontWeight: 700}}>Auto-skip</Typography>
    <Tabs value={service} onChange={(_,id: SkipService) => setService(id)} variant="fullWidth" sx={{mb: 1}}>
      {SERVICE_IDS.map(id => <Tab key={id} value={id} label={SERVICE_NAMES[id]} sx={{textTransform:'none',minWidth:0,px:1}} />)}
    </Tabs>
    <Stack>
      <FormControlLabel label={`Enable on ${SERVICE_NAMES[service]}`} control={<Switch checked={prefs.enabled} disabled={!ready} onChange={(_,v) => void update('enabled',v)} />} />
      {([['intro','Skip intros'],['recap','Skip recaps'],['credits','Play next episode during credits'], ...(service === 'netflix' ? [['continueWatching','Keep watching automatically']] : [])] as [keyof SkipPreferences,string][]).map(([key,label]) =>
        <FormControlLabel key={key} label={label} control={<Switch checked={prefs[key]} disabled={!ready || !prefs.enabled} onChange={(_,v) => void update(key,v)} />} />)}
    </Stack>
    {service !== 'netflix' && <Typography variant="caption" color="text.secondary">Intro and recap controls share a button on this service. Unrecognized labels are left for you to skip.</Typography>}
    {error && <Alert severity="error">{error}</Alert>}
  </Box>;
};
