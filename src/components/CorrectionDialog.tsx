import { CorrectionApi, Suggestion } from '@apis/CorrectionApi';
import { ExactItemDetails, TraktSearch } from '@apis/TraktSearch';
import { BrowserStorage } from '@common/BrowserStorage';
import { Cache } from '@common/Cache';
import { CorrectionDialogShowData } from '@common/Events';
import { I18N } from '@common/I18N';
import { Shared } from '@common/Shared';
import { cleanTraktUrl } from '@common/TraktUrl';
import { Center } from '@components/Center';
import { CustomDialogRoot } from '@components/CustomDialogRoot';
import { ScrobbleItem } from '@models/Item';
import {
	Button,
	CircularProgress,
	DialogActions,
	DialogContent,
	DialogContentText,
	DialogTitle,
	Divider,
	Link,
	List,
	ListItem,
	ListItemText,
	TextField,
	Typography,
} from '@mui/material';
import { ChangeEvent, CSSProperties, useEffect, useState } from 'react';
import { List as VirtualList } from 'react-window';

interface CorrectionDialogState {
	isOpen: boolean;
	isLoading: boolean;
	item?: ScrobbleItem;
	isScrobblingItem: boolean;
	url: string;
	correction: Suggestion | null;
}

interface SuggestionListItemData {
	suggestions: Suggestion[];
	suggestionUrls: Partial<Record<string, string>>;
	onCorrectButtonClick: (suggestion: Suggestion) => void;
}

interface CorrectionItemProps {
	correction: Suggestion;
	onClearButtonClick: () => Promisable<void>;
}

const SuggestionListItem = ({
	index,
	suggestions,
	suggestionUrls,
	onCorrectButtonClick,
	style,
}: SuggestionListItemData & { index: number; style: CSSProperties }): JSX.Element => {
	const suggestion = suggestions[index];
	const url = suggestionUrls[CorrectionApi.getSuggestionDatabaseId(suggestion)];
	return (
		<ListItem
			key={index}
			component="div"
			style={style}
			secondaryAction={
				<Button variant="contained" onClick={() => onCorrectButtonClick(suggestion)}>
					{I18N.translate('use')}
				</Button>
			}
		>
			<ListItemText
				primary={
					url ? (
						<Link href={url} target="_blank" rel="noopener">
							{suggestion.title}
						</Link>
					) : (
						suggestion.title
					)
				}
				secondary={I18N.translate('suggestedBy', suggestion.count.toString())}
			/>
		</ListItem>
	);
};

const CorrectionItem = ({ correction, onClearButtonClick }: CorrectionItemProps): JSX.Element => {
	return (
		<ListItem
			secondaryAction={
				<Button variant="contained" color="error" onClick={() => void onClearButtonClick()}>
					{I18N.translate('clear')}
				</Button>
			}
		>
			<ListItemText
				primary={<Typography>{correction.title}</Typography>}
				secondary={I18N.translate('suggestedBy', correction.count.toString())}
			/>
		</ListItem>
	);
};

export const CorrectionDialog = (): JSX.Element => {
	const [dialog, setDialog] = useState<CorrectionDialogState>({
		isOpen: false,
		isLoading: false,
		isScrobblingItem: false,
		url: '',
		correction: null,
	});
	const [suggestionUrls, setSuggestionUrls] = useState<Partial<Record<string, string>>>({});

	const closeDialog = (): void => {
		setDialog((prevDialog) => ({
			...prevDialog,
			isOpen: false,
		}));
	};

	const onUrlChange = (event: ChangeEvent<HTMLInputElement>): void => {
		const { target } = event;
		const url = target.value;
		setDialog((prevDialog) => ({
			...prevDialog,
			type: url.includes('shows') ? 'episode' : 'movie',
			traktId: 0,
			url: target.value,
		}));
	};

	const onCorrectButtonClick = async (suggestion?: Suggestion): Promise<void> => {
		setDialog((prevDialog) => ({
			...prevDialog,
			isLoading: true,
		}));
		try {
			if (!dialog.item) {
				throw new Error('Missing item');
			}
			const oldItem = dialog.item;
			let exactItemDetails: ExactItemDetails;
			if (suggestion) {
				exactItemDetails = {
					type: suggestion.type,
					id: suggestion.id,
				};
			} else {
				if (!isValidUrl(dialog.url)) {
					throw new Error('Invalid URL');
				}
				const url = cleanTraktUrl(dialog.url);
				exactItemDetails = { url };
			}
			const newItem = oldItem.clone();
			delete newItem.trakt;
			delete newItem.imageUrl;

			const databaseId = newItem.getDatabaseId();

			const caches = await Cache.get(['itemsToTraktItems', 'traktItems', 'urlsToTraktItems']);
			caches.itemsToTraktItems.set(databaseId, '');
			if ('url' in exactItemDetails) {
				caches.urlsToTraktItems.set(exactItemDetails.url, '');
			}
			newItem.trakt = await TraktSearch.find(newItem, caches, exactItemDetails);
			await Cache.set(caches);

			if (!newItem.trakt) {
				throw new Error('Failed to find item');
			}
			if (!suggestion) {
				suggestion = {
					type: newItem.trakt.type,
					id: newItem.trakt.id,
					title: newItem.trakt.title,
					count: 1,
				};
			}
			let { corrections } = await Shared.storage.get('corrections');
			if (!corrections) {
				corrections = {};
			}
			corrections[databaseId] = suggestion;
			await Shared.storage.set({ corrections }, true);
			if (Shared.storage.options.sendReceiveSuggestions) {
				await CorrectionApi.saveSuggestion(newItem, suggestion);
			}
			await Shared.events.dispatch(
				dialog.isScrobblingItem ? 'SCROBBLING_ITEM_CORRECTED' : 'ITEM_CORRECTED',
				null,
				{
					oldItem: oldItem.save(),
					newItem: newItem.save(),
				}
			);
		} catch (err) {
			if (Shared.errors.validate(err)) {
				Shared.errors.error('Failed to correct item.', err);
				await Shared.events.dispatch('SNACKBAR_SHOW', null, {
					messageName: 'correctItemFailed',
					severity: 'error',
				});
			}
		}
		setDialog((prevDialog) => ({
			...prevDialog,
			isOpen: false,
		}));
	};

	const onClearButtonClick = async (): Promise<void> => {
		setDialog((prevDialog) => ({
			...prevDialog,
			isLoading: true,
		}));
		try {
			if (!dialog.item) {
				throw new Error('Missing item');
			}
			const oldItem = dialog.item;
			const newItem = oldItem.clone();
			delete newItem.trakt;
			delete newItem.imageUrl;

			const databaseId = newItem.getDatabaseId();

			const caches = await Cache.get(['itemsToTraktItems', 'traktItems', 'urlsToTraktItems']);
			caches.itemsToTraktItems.set(databaseId, '');
			newItem.trakt = await TraktSearch.find(newItem, caches);
			await Cache.set(caches);

			let { corrections } = await Shared.storage.get('corrections');
			if (!corrections) {
				corrections = {};
			}
			delete corrections[databaseId];
			await Shared.storage.set({ corrections }, true);
			await Shared.events.dispatch(
				dialog.isScrobblingItem ? 'SCROBBLING_ITEM_CORRECTED' : 'ITEM_CORRECTED',
				null,
				{
					oldItem: oldItem.save(),
					newItem: newItem.save(),
				}
			);
		} catch (err) {
			if (Shared.errors.validate(err)) {
				Shared.errors.error('Failed to clear item.', err);
				await Shared.events.dispatch('SNACKBAR_SHOW', null, {
					messageName: 'correctItemFailed',
					severity: 'error',
				});
			}
		}
		setDialog((prevDialog) => ({
			...prevDialog,
			isOpen: false,
		}));
	};

	const isValidUrl = (url: string): boolean => cleanTraktUrl(url) !== '';

	useEffect(() => {
		const startListeners = () => {
			Shared.events.subscribe('CORRECTION_DIALOG_SHOW', null, openDialog);
		};

		const stopListeners = () => {
			Shared.events.unsubscribe('CORRECTION_DIALOG_SHOW', null, openDialog);
		};

		const openDialog = async (data: CorrectionDialogShowData) => {
			setSuggestionUrls({});
			let correction = null;

			if (data.item) {
				const { corrections } = await BrowserStorage.get(['corrections']);
				const databaseId = data.item.getDatabaseId();
				correction = corrections?.[databaseId] || null;
			}

			setDialog({
				isOpen: true,
				isLoading: false,
				...data,
				url: '',
				correction,
			});

			if (data.item?.suggestions && data.item.suggestions.length > 0) {
				const urls = await loadSuggestionUrls(data.item.suggestions);
				setSuggestionUrls(urls);
			}
		};

		/**
		 * Episode URLs in the Trakt app need the show ID, which suggestions don't have, so they are looked up when the dialog opens.
		 */
		const loadSuggestionUrls = async (
			suggestions: Suggestion[]
		): Promise<Partial<Record<string, string>>> => {
			const urls: Partial<Record<string, string>> = {};
			const caches = await Cache.get(['traktItems', 'urlsToTraktItems']);
			await Promise.all(
				suggestions.map(async (suggestion) => {
					try {
						const traktItem = await TraktSearch.findById(suggestion, caches);
						urls[CorrectionApi.getSuggestionDatabaseId(suggestion)] = traktItem.getUrl();
					} catch (err) {
						if (Shared.errors.validate(err)) {
							Shared.errors.log('Failed to get suggestion URL.', err);
						}
					}
				})
			);
			await Cache.set(caches);
			return urls;
		};

		startListeners();
		return stopListeners;
	}, []);

	const [urlLabel, urlError] =
		!dialog.url || isValidUrl(dialog.url)
			? ['URL', false]
			: [I18N.translate('invalidTraktUrl'), true];

	return (
		<CustomDialogRoot
			open={dialog.isOpen}
			aria-labelledby="correction-dialog-title"
			onClose={closeDialog}
		>
			<DialogTitle id="correction-dialog-title">{I18N.translate('correctItem')}</DialogTitle>
			{dialog.isLoading ? (
				<Center>
					<CircularProgress />
				</Center>
			) : (
				<>
					<DialogContent>
						{dialog.item?.trakt?.watchedAt && (
							<DialogContentText color="error">
								{I18N.translate('correctionDialogSyncedWarning')}
							</DialogContentText>
						)}
						<DialogContentText>
							{I18N.translate(
								dialog.item?.suggestions && dialog.item.suggestions.length > 0
									? 'correctionDialogContentWithSuggestions'
									: 'correctionDialogContent',
								dialog.item
									? `${dialog.item.title} ${
											dialog.item.type === 'episode'
												? `S${dialog.item.season?.toString() ?? '0'} E${
														dialog.item.number?.toString() ?? '0'
													}`
												: `(${dialog.item.year.toString()})`
										}`
									: I18N.translate('unknown')
							)}
						</DialogContentText>
						{dialog.item?.suggestions && dialog.item.suggestions.length > 0 && (
							<>
								<Divider />
								<DialogContentText
									sx={{
										marginTop: 1,
									}}
								>
									{I18N.translate('suggestions')}:
								</DialogContentText>
								<VirtualList
									rowCount={dialog.item.suggestions.length}
									rowProps={{
										suggestions: dialog.item.suggestions,
										suggestionUrls,
										onCorrectButtonClick,
									}}
									rowHeight={72}
									rowComponent={SuggestionListItem as never}
									style={{ width: '100%', height: 72 * 3 }}
								/>
								<Divider />
							</>
						)}
						{dialog.correction && (
							<>
								<Divider />
								<DialogContentText
									sx={{
										marginTop: 1,
									}}
								>
									{I18N.translate('currentCorrection')}:
								</DialogContentText>
								<List>
									<CorrectionItem
										correction={dialog.correction}
										onClearButtonClick={onClearButtonClick}
									/>
								</List>
								<Divider />
							</>
						)}
						<TextField
							type="string"
							id="correction-dialog-url"
							label={urlLabel}
							error={urlError}
							placeholder="https://app.trakt.tv/shows/dark?view=episode&season=1&episode=1"
							value={dialog.url}
							autoFocus
							fullWidth
							margin="normal"
							size="small"
							onChange={onUrlChange}
						/>
					</DialogContent>
					<DialogActions>
						<Button onClick={closeDialog}>{I18N.translate('cancel')}</Button>
						<Button
							disabled={!dialog.url || urlError}
							variant="contained"
							onClick={() => void onCorrectButtonClick()}
						>
							{I18N.translate('correct')}
						</Button>
					</DialogActions>
				</>
			)}
		</CustomDialogRoot>
	);
};
