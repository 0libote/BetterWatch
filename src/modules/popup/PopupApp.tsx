import { LoginWrapper } from '@components/LoginWrapper';
import { SkipControls } from '@components/SkipControls';
import { LoginPage } from '@pages/LoginPage';
import { HomePage } from '@pages/PopupHomePage';
import { useSession } from '@contexts/SessionContext';
import { Session } from '@common/Session';
import { Box, Button, Divider, Stack, Typography } from '@mui/material';
import { Navigate, Route, Routes } from 'react-router-dom';
import browser from 'webextension-polyfill';

export const PopupApp = (): JSX.Element => {
  const {isLoggedIn} = useSession();
  return <Box sx={{width:400,bgcolor:'background.default'}}>
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{p:2,pb:1.5}}>
      <Stack direction="row" spacing={1.3} alignItems="center">
        <Box component="img" src="images/betterwatch-48.png" width={34} height={34} sx={{borderRadius:1.5}} />
        <Box><Typography sx={{fontSize:21,fontWeight:800,letterSpacing:'-0.7px'}}>BetterWatch</Typography>
          <Typography variant="caption" color="text.secondary">Stay with the story.</Typography></Box>
      </Stack>
      <Button size="small" onClick={() => void browser.runtime.openOptionsPage()}>Settings</Button>
    </Stack>
    <Box sx={{mx:2.5,p:2,bgcolor:'action.hover',borderRadius:2,minHeight:112}}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/home" element={<LoginWrapper><HomePage /></LoginWrapper>} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Box>
    <Box sx={{px:2.5,py:2}}><SkipControls /></Box>
    <Divider />
    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{px:2.5,py:1.3}}>
      <Button size="small" onClick={() => void browser.tabs.create({url: browser.runtime.getURL('history.html')})}>Review watch history</Button>
      {isLoggedIn ? <Button size="small" onClick={() => void Session.logout()}>Disconnect</Button> : <Typography variant="caption" color="text.secondary">Chrome · v0.1</Typography>}
    </Stack>
  </Box>;
};
