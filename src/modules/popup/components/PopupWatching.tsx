import { I18N } from '@common/I18N';
import { Shared } from '@common/Shared';
import { CorrectionDialog } from '@components/CorrectionDialog';
import { CustomSnackbar } from '@components/CustomSnackbar';
import { ScrobbleItem } from '@models/Item';
import { Box, Button, LinearProgress, Typography } from '@mui/material';

export interface PopupWatchingProps {item: ScrobbleItem; isPaused: boolean}
export const PopupWatching = ({item,isPaused}: PopupWatchingProps): JSX.Element => {
  const openCorrection = async () => Shared.events.dispatch('CORRECTION_DIALOG_SHOW',null,{item,isScrobblingItem:true});
  return <Box>
    <Typography variant="caption" color="text.secondary">{isPaused ? 'Paused on Trakt' : 'Now tracking on Trakt'}</Typography>
    <Typography sx={{fontWeight:700,fontSize:18}}>{item.trakt?.type === 'episode' ? item.trakt.show.title : item.trakt?.title}</Typography>
    {item.trakt?.type === 'episode' && <Typography variant="body2">{item.trakt.title}</Typography>}
    <LinearProgress aria-label="Playback progress" value={Math.min(100,Math.max(0,item.progress || 0))} variant="determinate" sx={{mt:1.5,mb:.5,borderRadius:1}} />
    <Button size="small" onClick={() => void openCorrection()}>{I18N.translate('isThisWrong')}</Button>
    <CorrectionDialog /><CustomSnackbar />
  </Box>;
};
