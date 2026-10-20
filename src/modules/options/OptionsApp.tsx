import { SkipControls } from '@components/SkipControls';
import { TraktSetup } from '@components/TraktSetup';
import { Divider, Typography } from '@mui/material';
import { Shared } from '@common/Shared';
import { CustomDialog } from '@components/CustomDialog';
import { CustomSnackbar } from '@components/CustomSnackbar';
import { OptionsActions } from '@components/OptionsActions';
import { OptionsHeader } from '@components/OptionsHeader';
import { OptionsList } from '@components/OptionsList';
import { Container } from '@mui/material';

export const OptionsApp = (): JSX.Element => {
	return (
		<>
			<OptionsHeader />
			<Container maxWidth="md"
				sx={{
					paddingTop: 2,
					paddingBottom: '100px',
				}}
			>
				<Typography color="text.secondary">Netflix, Prime Video, and HBO Max. Prime Video title detection currently requires English.</Typography>
				<TraktSetup />
				<Divider sx={{my:3}} />
				<SkipControls />
				<Divider sx={{my:3}} />
				<Typography variant="h5" sx={{mb:2,fontWeight:700}}>Trakt and history preferences</Typography>
				<OptionsList details={Shared.storage.optionsDetails} />
				<OptionsActions />
				<CustomDialog />
				<CustomSnackbar />
			</Container>
		</>
	);
};
