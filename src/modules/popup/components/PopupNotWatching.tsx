import { Box, Typography } from '@mui/material';
export const PopupNotWatching = (): JSX.Element => <Box>
  <Typography sx={{fontWeight:700}}>Trakt is connected.</Typography>
  <Typography variant="body2" color="text.secondary" sx={{mt:.5}}>Play a show or movie on Netflix, Prime Video, or HBO Max to start tracking.</Typography>
</Box>;
