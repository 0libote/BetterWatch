import { I18N } from '@common/I18N';
import { AppBar, Toolbar, Typography } from '@mui/material';

export const OptionsHeader = (): JSX.Element => {
	return (
		<AppBar position="sticky">
			<Toolbar>
				<Typography variant="h6">BetterWatch settings</Typography>
			</Toolbar>
		</AppBar>
	);
};
